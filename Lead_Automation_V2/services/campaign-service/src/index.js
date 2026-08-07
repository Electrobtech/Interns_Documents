const path = require('path');
const express = require('express');
const cors = require('cors');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');

const templatesRouter = require('./templates');
const templateMediaRouter = require('./templateMedia');
const productsRouter = require('./products');
const { enqueueBroadcast } = require('./services/bulkCampaignQueue');
const { startBulkCampaignWorker } = require('./services/bulkCampaignWorker');

const app = express();
app.use(cors());
app.use(express.json());

// Header image/video/document uploads for the Template Creator (see
// templateMedia.js) are served back through the gateway at this same
// path — mounted before `authenticate` since the browser's <img> tag
// hits this directly, with no Authorization header attached.
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.use(authenticate);

const canWrite = requirePermission('campaigns:write');
const canDelete = requirePermission('campaigns:delete');

app.get('/health', (_req, res) => res.json({ service: 'campaign', ok: true }));

// Message Templates (Template Creation module) + their media uploads, and
// Products/Offers — both marketing objects that live next to `campaigns`.
// See templates.js / templateMedia.js / products.js file headers.
app.use(templatesRouter);
app.use(templateMediaRouter);
app.use(productsRouter);

const CAMPAIGN_STATUSES = new Set([
  'draft', 'needs_approval', 'scheduled', 'sent', 'active', 'paused',
  'rejected', 'queued', 'processing', 'completed', 'failed',
]);

/**
 * GET /campaigns
 * Every campaign for this org — backs both the unified Campaigns &
 * Broadcasts table (frontend/src/app/app/campaigns/page.jsx) and the Bulk
 * Campaign tab's polling (BulkCampaignTab.jsx does GET /campaigns/:id
 * instead, but list shares the same shape).
 */
app.get('/campaigns', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.user.organizationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[campaigns] list failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /campaigns/:id */
app.get('/campaigns/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /campaigns/:id/status — lightweight poll target, same fields as the
 * full row but without pulling the rest of the campaign (kept as a thin
 * wrapper around the same row for now since campaigns aren't large).
 */
app.get('/campaigns/:id/status', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status, total_recipients, sent_count, failed_count
         FROM campaigns WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /campaigns/:id/recipients — per-recipient send status, powers both
 * the Campaigns page's DetailsModal and the Bulk Campaign tab's live
 * progress panel.
 */
app.get('/campaigns/:id/recipients', async (req, res) => {
  try {
    const { rows: campaignRows } = await pool.query(
      `SELECT id FROM campaigns WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    if (!campaignRows.length) return res.status(404).json({ error: 'Campaign not found.' });

    const { rows } = await pool.query(
      `SELECT * FROM campaign_recipients WHERE campaign_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[campaigns] recipients failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /campaigns — the Campaigns page's "New Campaign" modal: a single
 * campaign row with no recipients attached yet (recipients for this flow
 * come from campaign_audiences via a separate step, not built yet — see
 * finding tracked in CONTINUE_PROMPT). Distinct from POST
 * /campaigns/broadcast below, which is the SMS/RCS bulk pipeline and
 * creates its recipients up front.
 */
app.post('/campaigns', canWrite, async (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: 'name is required.' });
  }
  const status = b.status && CAMPAIGN_STATUSES.has(b.status) ? b.status : 'draft';
  try {
    const { rows } = await pool.query(
      `INSERT INTO campaigns (
         organization_id, name, type, channel_type, message_body,
         scheduled_at, status, template_id
       ) VALUES ($1,$2,COALESCE($3,'broadcast'),$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        req.user.organizationId, String(b.name).trim(), b.type || null,
        b.channel_type || null, b.message_body || null,
        b.scheduled_at || null, status, b.template_id || null,
      ]
    );
    logAudit(req, 'campaign.create', { id: rows[0].id, name: rows[0].name });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[campaigns] create failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** PUT /campaigns/:id — partial update (e.g. status: 'needs_approval' when
 *  submitting a draft for review). Every field optional. */
app.put('/campaigns/:id', canWrite, async (req, res) => {
  const b = req.body || {};
  if (b.status && !CAMPAIGN_STATUSES.has(b.status)) {
    return res.status(400).json({ error: `status must be one of ${[...CAMPAIGN_STATUSES].join(', ')}.` });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE campaigns SET
         name           = COALESCE($3, name),
         type           = COALESCE($4, type),
         channel_type   = COALESCE($5, channel_type),
         message_body   = COALESCE($6, message_body),
         scheduled_at   = COALESCE($7, scheduled_at),
         status         = COALESCE($8, status),
         template_id    = COALESCE($9, template_id)
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [
        req.params.id, req.user.organizationId,
        b.name || null, b.type || null, b.channel_type || null, b.message_body || null,
        b.scheduled_at || null, b.status || null, b.template_id || null,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found.' });
    logAudit(req, 'campaign.update', { id: req.params.id, changes: b });
    res.json(rows[0]);
  } catch (err) {
    console.error('[campaigns] update failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /campaigns/:id/decision — { decision: 'approved'|'rejected', note? }
 * The Approval Queue's Approve/Check and Reject/X buttons. Approving a
 * scheduled campaign moves it to 'scheduled'; approving one with no
 * scheduled_at moves it straight to 'sent' (nothing here actually
 * triggers a WhatsApp/ad-platform send yet — see CONTINUE_PROMPT's open
 * findings — this only advances the workflow status).
 */
app.post('/campaigns/:id/decision', canWrite, async (req, res) => {
  const decision = String(req.body?.decision || '').toLowerCase();
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'." });
  }
  try {
    const { rows: existing } = await pool.query(
      `SELECT * FROM campaigns WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Campaign not found.' });

    const nextStatus = decision === 'rejected'
      ? 'rejected'
      : (existing[0].scheduled_at ? 'scheduled' : 'sent');

    const { rows } = await pool.query(
      `UPDATE campaigns SET status = $3 WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [req.params.id, req.user.organizationId, nextStatus]
    );
    logAudit(req, `campaign.${decision}`, { id: req.params.id, note: req.body?.note || null });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /campaigns/:id */
app.delete('/campaigns/:id', canDelete, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM campaigns WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found.' });
    logAudit(req, 'campaign.delete', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /campaigns/broadcast — the SMS/RCS Bulk Campaign tab's single
 * submit call (BulkCampaignTab.jsx's handleSubmit). Creates the campaign
 * row plus one campaign_recipients row per recipient, then hands them to
 * BullMQ via enqueueBroadcast (bulkCampaignQueue.js), which paces jobs
 * according to throttlePerMinute and, if scheduledAt is set, delays every
 * job's eligibility until then — so status starts at 'queued' either way
 * and moves to 'processing'/'completed'/'failed' as bulkCampaignWorker.js
 * updates recipients (see refreshCampaignStatus there).
 *
 * Body: { name, channelType, messageBody, recipients: [{phone, name,
 *   variables}], recipientSource, sendMode, scheduledAt, throttlePerMinute }
 */
app.post('/campaigns/broadcast', canWrite, async (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: 'name is required.' });
  }
  const recipients = Array.isArray(b.recipients) ? b.recipients.filter((r) => r && r.phone) : [];
  if (!recipients.length) {
    return res.status(400).json({ error: 'At least one recipient with a phone number is required.' });
  }

  // NOTE: deliberately NOT pool.connect() for this transaction. That call
  // checks out a brand-new, unscoped connection — bypassing the single
  // tenant-scoped connection shared/src/auth.js's `authenticate` already
  // pinned to this request via AsyncLocalStorage (see shared/src/db.js).
  // A fresh connection has no app.current_org set, so RLS's WITH CHECK
  // rejects every INSERT below with "new row violates row-level security
  // policy" — confirmed live against a real Postgres 16 + RLS stack.
  // pool.query() is already routed onto the pinned connection, so BEGIN/
  // COMMIT/ROLLBACK on it just extends the request's existing scope
  // instead of escaping it. (Same bug, found live, also still open in
  // products.js's two transactions and contact-service/importRoutes.js's
  // CSV import — see CONTINUE_PROMPT notes.)
  try {
    await pool.query('BEGIN');

    const { rows: campaignRows } = await pool.query(
      `INSERT INTO campaigns (
         organization_id, name, type, channel_type, message_body, scheduled_at,
         status, recipient_source, send_mode, throttle_per_minute, total_recipients
       ) VALUES ($1,$2,'broadcast',$3,$4,$5,'queued',$6,$7,$8,$9)
       RETURNING *`,
      [
        req.user.organizationId, String(b.name).trim(), b.channelType || 'sms',
        b.messageBody || null, b.scheduledAt || null,
        b.recipientSource || null, b.sendMode || 'immediate',
        Number(b.throttlePerMinute) || 60, recipients.length,
      ]
    );
    const campaign = campaignRows[0];

    // Resolve each recipient to an existing contact by phone within this
    // org, when one exists — best-effort, a CSV/manual row with no
    // matching contact still gets its own recipient row (contact_id NULL).
    const insertedRecipients = [];
    for (const r of recipients) {
      const { rows: contactRows } = await pool.query(
        `SELECT id FROM contacts WHERE organization_id = $1 AND phone = $2 LIMIT 1`,
        [req.user.organizationId, r.phone]
      );
      const { rows: recRows } = await pool.query(
        `INSERT INTO campaign_recipients (campaign_id, contact_id, phone, name, variables)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, phone, name, variables`,
        [campaign.id, contactRows[0]?.id || null, r.phone, r.name || null, JSON.stringify(r.variables || {})]
      );
      insertedRecipients.push(recRows[0]);
    }

    await pool.query('COMMIT');
    logAudit(req, 'campaign.broadcast', { id: campaign.id, recipientCount: insertedRecipients.length });

    await enqueueBroadcast(campaign.id, insertedRecipients, {
      throttlePerMinute: Number(b.throttlePerMinute) || 60,
      channelType: b.channelType || 'sms',
      scheduledAt: b.scheduledAt || null,
    });

    res.status(201).json({ campaign });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[campaigns] broadcast failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

startBulkCampaignWorker();

const PORT = process.env.CAMPAIGN_PORT || 4004;
app.listen(PORT, () => console.log(`campaign-service on :${PORT}`));
