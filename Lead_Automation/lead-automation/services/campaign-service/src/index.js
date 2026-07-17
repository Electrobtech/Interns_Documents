const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

// jsonb columns accept either a JSON string (from a textarea) or a JS object.
const asJson = (v) => (v == null || v === '' ? null : typeof v === 'string' ? v : JSON.stringify(v));

const INTEGRATION_SERVICE_URL = process.env.INTEGRATION_SERVICE_URL || 'http://localhost:4009';

app.get('/health', (_req, res) => res.json({ service: 'campaign', ok: true }));

app.get('/campaigns', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM campaigns WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/campaigns', async (req, res) => {
  const { name, type, channel_type, message_body, media_url, media_type, template_name, cta, scheduled_at, status } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO campaigns (organization_id, name, type, channel_type, message_body, media_url, media_type, template_name, cta, scheduled_at, status)
     VALUES ($1,$2,COALESCE($3,'broadcast'),$4,$5,$6,$7,$8,$9,$10,COALESCE($11,'draft')) RETURNING *`,
    [req.user.organizationId, name, type, channel_type, message_body, media_url || null, media_type || null,
     template_name || null, asJson(cta), scheduled_at || null, status]
  );
  res.status(201).json(rows[0]);
});

app.get('/campaigns/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/campaigns/:id', async (req, res) => {
  const { name, type, channel_type, message_body, media_url, media_type, template_name, cta, scheduled_at, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE campaigns SET name=COALESCE($1,name), type=COALESCE($2,type),
            channel_type=COALESCE($3,channel_type), message_body=COALESCE($4,message_body),
            media_url=COALESCE($5,media_url), media_type=COALESCE($6,media_type),
            template_name=COALESCE($7,template_name),
            cta=COALESCE($8,cta), scheduled_at=COALESCE($9,scheduled_at), status=COALESCE($10,status)
      WHERE id=$11 AND organization_id=$12 RETURNING *`,
    [name, type, channel_type, message_body, media_url, media_type, template_name, asJson(cta),
     scheduled_at || null, status, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/campaigns/:id', async (req, res) => {
  await pool.query(`DELETE FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

/**
 * Sends one campaign message to one contact over WhatsApp, choosing the
 * right integration-service route:
 *  - a template name is required outside the 24h session window (the
 *    normal case for a cold broadcast), so prefer it when set
 *  - otherwise fall back to a media message or a plain text send
 */
async function sendToContact(authHeader, campaign, contact) {
  const headers = { 'Content-Type': 'application/json', Authorization: authHeader };
  const call = async (path, payload) => {
    const resp = await fetch(`${INTEGRATION_SERVICE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || `Send failed (HTTP ${resp.status})`);
    return data;
  };

  if (campaign.template_name) {
    return call('/whatsapp/send-template', { to: contact.phone, templateName: campaign.template_name });
  }
  if (campaign.media_url) {
    return call('/whatsapp/send-media', {
      to: contact.phone, mediaType: campaign.media_type || 'image', link: campaign.media_url, caption: campaign.message_body,
    });
  }
  return call('/whatsapp/send', { to: contact.phone, text: campaign.message_body });
}

/**
 * Broadcasts the campaign to its full audience and logs a per-contact
 * result, instead of the old behavior of just flipping status to 'sent'
 * without actually sending anything.
 *
 * Currently only channel_type='whatsapp' is wired to a real send — Meta
 * doesn't allow unsolicited broadcast DMs on Instagram/Messenger outside an
 * open 24h session, so for those channels this responds with guidance to
 * use a public post instead (see /instagram/publish, /facebook/publish).
 */
app.post('/campaigns/:id/send', async (req, res) => {
  const { rows: campaignRows } = await pool.query(
    `SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  if (!campaignRows.length) return res.status(404).json({ error: 'Campaign not found.' });
  const campaign = campaignRows[0];

  if (campaign.channel_type !== 'whatsapp') {
    return res.status(400).json({
      error: `Broadcasting isn't supported for channel "${campaign.channel_type}". ` +
        `Meta doesn't allow unsolicited bulk DMs on Instagram/Messenger — publish a ` +
        `public post instead (see the Instagram/Facebook publish endpoints).`,
    });
  }
  if (!campaign.message_body && !campaign.media_url && !campaign.template_name) {
    return res.status(400).json({ error: 'Campaign has no message_body, media_url, or template_name to send.' });
  }

  const { rows: audience } = await pool.query(
    `SELECT c.id, c.name, c.phone FROM campaign_audiences ca
       JOIN contacts c ON c.id = ca.contact_id
      WHERE ca.campaign_id = $1 AND c.phone IS NOT NULL`,
    [req.params.id]
  );

  if (!audience.length) {
    return res.status(400).json({ error: 'No contacts with a phone number in this campaign\'s audience.' });
  }

  let sent = 0, failed = 0;
  for (const contact of audience) {
    try {
      await sendToContact(req.headers.authorization, campaign, contact);
      await pool.query(`INSERT INTO campaign_logs (campaign_id, contact_id, event) VALUES ($1,$2,'delivered')`,
        [req.params.id, contact.id]);
      sent += 1;
    } catch (err) {
      console.error(`Broadcast to contact ${contact.id} failed:`, err.message);
      await pool.query(`INSERT INTO campaign_logs (campaign_id, contact_id, event, detail) VALUES ($1,$2,'failed',$3)`,
        [req.params.id, contact.id, err.message]);
      failed += 1;
    }
  }

  const { rows } = await pool.query(
    `UPDATE campaigns SET status='sent' WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [req.params.id, req.user.organizationId]
  );

  res.json({ ...rows[0], sent, failed, total: audience.length });
});

const PORT = process.env.CAMPAIGN_PORT || 4004;
app.listen(PORT, () => console.log(`campaign-service on :${PORT}`));
