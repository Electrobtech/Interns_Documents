const express = require('express');
const cors = require('cors');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

const canWrite = requirePermission('campaigns:write');
const canSend = requirePermission('campaigns:send');

// jsonb columns accept either a JSON string (from a textarea) or a JS object.
const asJson = (v) => (v == null || v === '' ? null : typeof v === 'string' ? v : JSON.stringify(v));

app.get('/health', (_req, res) => res.json({ service: 'campaign', ok: true }));

app.get('/campaigns', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM campaigns WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/campaigns', canWrite, async (req, res) => {
  const { name, type, channel_type, message_body, cta, scheduled_at, status } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO campaigns (organization_id, name, type, channel_type, message_body, cta, scheduled_at, status)
     VALUES ($1,$2,COALESCE($3,'broadcast'),$4,$5,$6,$7,COALESCE($8,'draft')) RETURNING *`,
    [req.user.organizationId, name, type, channel_type, message_body, asJson(cta), scheduled_at || null, status]
  );
  logAudit(req, 'campaign.create', { id: rows[0].id, name });
  res.status(201).json(rows[0]);
});

app.get('/campaigns/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/campaigns/:id', canWrite, async (req, res) => {
  const { name, type, channel_type, message_body, cta, scheduled_at, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE campaigns SET name=COALESCE($1,name), type=COALESCE($2,type),
            channel_type=COALESCE($3,channel_type), message_body=COALESCE($4,message_body),
            cta=COALESCE($5,cta), scheduled_at=COALESCE($6,scheduled_at), status=COALESCE($7,status)
      WHERE id=$8 AND organization_id=$9 RETURNING *`,
    [name, type, channel_type, message_body, asJson(cta), scheduled_at || null, status,
     req.params.id, req.user.organizationId]
  );
  logAudit(req, 'campaign.update', { id: req.params.id, changes: { name, status } });
  res.json(rows[0] || {});
});

app.delete('/campaigns/:id', canWrite, async (req, res) => {
  await pool.query(`DELETE FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  logAudit(req, 'campaign.delete', { id: req.params.id });
  res.json({ ok: true });
});

// automation-service owns the channel Send API credentials + the Unified
// Inbox transcript writes (messageRepository), so actually delivering a
// campaign message is a service-to-service call there rather than campaign-
// service reaching across process/Docker-image boundaries for it (each
// service's Dockerfile only COPYs its own src + shared — see automation-
// service/Dockerfile). The two services share one JWT secret (@lead/shared),
// so forwarding the caller's own bearer token is enough to authenticate.
const AUTOMATION_SERVICE_URL = process.env.AUTOMATION_SERVICE_URL || 'http://localhost:4011';

// Sends a campaign to every contact in its audience, marks it sent, and logs
// a real per-contact campaign_logs event for each attempt. One contact's
// failure (bad/missing number, expired token, a transcript write hiccup on
// the automation-service side, etc) never aborts the rest of the run —
// every outcome is caught and recorded rather than thrown.
app.post('/campaigns/:id/send', canSend, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE campaigns SET status='sent' WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [req.params.id, req.user.organizationId]
  );
  const campaign = rows[0];
  if (!campaign) return res.json({});
  logAudit(req, 'campaign.send', { id: campaign.id, name: campaign.name, channel: campaign.channel_type });

  const { rows: audience } = await pool.query(
    `SELECT c.* FROM campaign_audiences ca
       JOIN contacts c ON c.id = ca.contact_id
      WHERE ca.campaign_id = $1`,
    [campaign.id]
  );

  const authHeader = req.headers.authorization;
  const logEvent = (contactId, event) =>
    pool.query(`INSERT INTO campaign_logs (campaign_id, contact_id, event) VALUES ($1,$2,$3)`,
      [campaign.id, contactId, event]
    ).catch((err) => console.error('[campaign-service] failed to write campaign_log (non-fatal):', err.message));

  await Promise.all(audience.map(async (contact) => {
    // WhatsApp sends to the E.164 phone number; Instagram (and anything
    // else) sends to the channel-scoped external_id (PSID etc) — falls back
    // to external_id either way in case a contact has no phone on file.
    const externalId = campaign.channel_type === 'whatsapp'
      ? (contact.phone || contact.external_id)
      : contact.external_id;

    if (!externalId) return logEvent(contact.id, 'failed');

    try {
      const resp = await fetch(`${AUTOMATION_SERVICE_URL}/automation/internal/campaign-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ channel: campaign.channel_type, externalId, body: campaign.message_body }),
      });
      await logEvent(contact.id, resp.ok ? 'delivered' : 'failed');
    } catch (err) {
      console.error(`[campaign-service] send failed for contact ${contact.id}:`, err.message);
      await logEvent(contact.id, 'failed');
    }
  }));

  res.json(campaign);
});

const PORT = process.env.CAMPAIGN_PORT || 4004;
app.listen(PORT, () => console.log(`campaign-service on :${PORT}`));