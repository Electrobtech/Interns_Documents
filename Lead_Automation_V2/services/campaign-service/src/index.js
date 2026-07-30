require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');
const { enqueueBroadcast } = require('./services/bulkCampaignQueue');
const { startBulkCampaignWorker } = require('./services/bulkCampaignWorker');

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

// Human-approval gate — a campaign sitting in 'needs_approval' cannot be sent
// until a reviewer decides. Approving moves it to 'scheduled' if it already
// has a scheduled_at, otherwise back to 'draft' (ready, but still requires
// an explicit send/schedule action). Rejecting is a distinct terminal status
// so the Approval Queue can show it was reviewed and declined, not just reset.
app.post('/campaigns/:id/decision', canWrite, async (req, res) => {
  const { decision, note } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }
  const { rows: existing } = await pool.query(
    `SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  const campaign = existing[0];
  if (!campaign) return res.status(404).json({ error: 'not found' });
  if (campaign.status !== 'needs_approval') {
    return res.status(400).json({ error: 'campaign is not pending approval' });
  }

  const newStatus = decision === 'approved'
    ? (campaign.scheduled_at ? 'scheduled' : 'draft')
    : 'rejected';

  const { rows } = await pool.query(
    `UPDATE campaigns SET status=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [newStatus, req.params.id, req.user.organizationId]
  );
  logAudit(req, `campaign.${decision}`, { id: campaign.id, name: campaign.name, note: note || null });
  res.json(rows[0]);
});

// ---------------------------------------------------------------------
// Bulk Messaging / Broadcast Campaign
//
// This is a deliberately separate path from POST /campaigns/:id/send above:
// that route sends one static message_body to a pre-existing
// campaign_audiences list synchronously (a handful of contacts, fine to
// await in-request). This route is built for "thousands of rows from a
// CSV, running an actual flow, at a controlled rate" — it creates the
// campaign + every campaign_recipients row, hands them to BullMQ
// (bulkCampaignQueue.js), and returns immediately; the worker
// (bulkCampaignWorker.js) does the actual (simulated) sending afterward.
// ---------------------------------------------------------------------

/**
 * POST /campaigns/broadcast
 * Body: {
 *   name, channelType: 'sms' | 'rcs',
 *   messageBody,              // the flow's template text, {{var}} placeholders,
 *                              // resolved client-side from SmsAutomationSimulator's
 *                              // local flow catalog (no server-side flow lookup for SMS)
 *   recipients: [{ phone, name, variables }],   // already parsed client-side
 *                                                 // from CSV / manual entry / segment
 *   recipientSource: 'csv' | 'manual' | 'segment',
 *   sendMode: 'immediate' | 'scheduled', scheduledAt,
 *   throttlePerMinute,
 * }
 */
app.post('/campaigns/broadcast', canSend, async (req, res) => {
  const {
    name, channelType, messageBody, recipients, recipientSource,
    sendMode = 'immediate', scheduledAt, throttlePerMinute = 60,
  } = req.body;

  if (!name || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'name and a non-empty recipients[] array are required.' });
  }
  if (sendMode === 'scheduled' && !scheduledAt) {
    return res.status(400).json({ error: 'scheduledAt is required when sendMode is "scheduled".' });
  }

  // Recipients need at least a phone number; silently dropping unusable
  // rows here (rather than failing the whole upload) matches how a real
  // CSV import behaves elsewhere in this codebase (see campaign-service's
  // /send route treating a missing external id as a per-contact failure,
  // not a request-level error).
  const validRecipients = recipients.filter((r) => r && typeof r.phone === 'string' && r.phone.trim());
  if (validRecipients.length === 0) {
    return res.status(400).json({ error: 'No recipient in the list had a usable phone number.' });
  }

  // NOTE: this uses pool.query (not pool.connect()) for BEGIN/COMMIT/ROLLBACK
  // too. authenticate() (see shared/src/auth.js) already wraps this whole
  // request in withTenantScope(), which checks out one Postgres connection,
  // sets app.current_org on it, and pins it via AsyncLocalStorage so every
  // pool.query() call in this request's async call graph transparently runs
  // on that same connection (see shared/src/db.js). A separate
  // pool.connect() here would hand out a *different*, unscoped connection —
  // app.current_org never gets set on it, and the RLS policies on
  // `campaigns`/`campaign_recipients` fail closed on the INSERT.
  try {
    await pool.query('BEGIN');

    const { rows: campaignRows } = await pool.query(
      `INSERT INTO campaigns (
         organization_id, name, type, channel_type, message_body,
         recipient_source, send_mode, scheduled_at, throttle_per_minute,
         total_recipients, status
       ) VALUES ($1,$2,'broadcast',$3,$4,$5,$6,$7,$8,$9, $10)
       RETURNING *`,
      [
        req.user.organizationId, name, channelType || 'sms', messageBody || null,
        recipientSource || 'manual', sendMode, sendMode === 'scheduled' ? scheduledAt : null,
        throttlePerMinute, validRecipients.length,
        sendMode === 'scheduled' ? 'scheduled' : 'queued',
      ]
    );
    const campaign = campaignRows[0];

    // Bulk-insert every recipient row in one round trip rather than N
    // inserts — UNNEST turns the three parallel arrays into rows.
    const phones = validRecipients.map((r) => r.phone.trim());
    const names = validRecipients.map((r) => r.name || null);
    const variables = validRecipients.map((r) => JSON.stringify(r.variables || {}));

    const { rows: recipientRows } = await pool.query(
      `INSERT INTO campaign_recipients (campaign_id, phone, name, variables)
       SELECT $1, p, n, v::jsonb
         FROM UNNEST($2::text[], $3::text[], $4::text[]) AS t(p, n, v)
       RETURNING id, phone, name, variables`,
      [campaign.id, phones, names, variables]
    );

    await pool.query('COMMIT');

    logAudit(req, 'campaign.broadcast_created', { id: campaign.id, name, recipientCount: recipientRows.length });

    // Enqueueing happens after COMMIT: a worker picking up a job whose
    // campaign_recipients row doesn't exist yet (because we're still mid-
    // transaction) would just error out, so BullMQ only sees these jobs
    // once Postgres has durably committed them.
    const enqueued = await enqueueBroadcast(campaign.id, recipientRows, {
      throttlePerMinute,
      channelType: channelType || 'sms',
      scheduledAt: sendMode === 'scheduled' ? scheduledAt : null,
    });

    res.status(201).json({ campaign, queuedRecipients: enqueued.length });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[campaign-service] broadcast creation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /campaigns/:id/recipients
 * Per-recipient status list for the Bulk Campaign tab's diagnostics view
 * (error messages, retry counts) — the aggregate sent/failed_count on the
 * campaign row itself (returned by GET /campaigns/:id) is enough for the
 * live progress bar alone.
 */
app.get('/campaigns/:id/recipients', async (req, res) => {
  const { rows: owned } = await pool.query(
    `SELECT id FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  if (!owned[0]) return res.status(404).json({ error: 'not found' });

  const { rows } = await pool.query(
    `SELECT id, phone, name, status, error, attempts, rendered_message, sent_at
       FROM campaign_recipients WHERE campaign_id=$1
      ORDER BY updated_at DESC LIMIT 500`,
    [req.params.id]
  );
  res.json(rows);
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
app.listen(PORT, () => {
  console.log(`campaign-service on :${PORT}`);
  startBulkCampaignWorker();
});