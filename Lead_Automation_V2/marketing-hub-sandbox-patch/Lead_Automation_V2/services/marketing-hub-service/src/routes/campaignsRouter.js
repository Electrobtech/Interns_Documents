/**
 * Router factory — mounted twice in index.js (kind='campaign' at
 * /campaigns, kind='broadcast' at /broadcasts) so campaign vs broadcast
 * CRUD stays DRY on the single mh_campaigns table's `kind` discriminator,
 * while the frontend still gets the two separate REST namespaces its two
 * separate pages/hooks expect.
 */
const express = require('express');
const { pool, requirePermission, logAudit } = require('@lead/shared');
const { enqueueRecipients } = require('../services/mhQueue');
const { resolveRecipients } = require('../services/audienceResolver');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const canWrite = requirePermission('campaigns:write');
const canSend = requirePermission('campaigns:send');

const CHANNELS = ['whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin'];

function buildRouter(kind) {
  const router = express.Router();

  router.get('/', ah(async (req, res) => {
    const { status } = req.query;
    const { rows } = await pool.query(
      status
        ? `SELECT * FROM mh_campaigns WHERE organization_id=$1 AND kind=$2 AND status=$3 ORDER BY created_at DESC LIMIT 500`
        : `SELECT * FROM mh_campaigns WHERE organization_id=$1 AND kind=$2 ORDER BY created_at DESC LIMIT 500`,
      status ? [req.user.organizationId, kind, status] : [req.user.organizationId, kind]
    );
    res.json(rows);
  }));

  router.post('/', canWrite, ah(async (req, res) => {
    const { name, channel, objective, audience_id, message_body, budget_amount, start_date, end_date, scheduled_at } = req.body;
    if (!name || !channel) return res.status(400).json({ error: 'name and channel are required.' });
    if (!CHANNELS.includes(channel)) return res.status(400).json({ error: `channel must be one of: ${CHANNELS.join(', ')}` });
    // Route-level reject in front of the DB CHECK constraint (defense in
    // depth, same "server re-checks regardless of what the UI already
    // prevents" discipline as campaign-service's own validation).
    if (kind === 'broadcast' && channel === 'linkedin') {
      return res.status(400).json({ error: 'LinkedIn does not support broadcasts — campaigns only.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO mh_campaigns (organization_id, kind, name, channel, objective, audience_id, message_body, budget_amount, start_date, end_date, scheduled_at, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12) RETURNING *`,
      [req.user.organizationId, kind, name, channel, objective || null, audience_id || null, message_body || null,
       budget_amount || null, start_date || null, end_date || null, scheduled_at || null, req.user.userId]
    );
    logAudit(req, `mh_${kind}.create`, { id: rows[0].id, name });
    res.status(201).json(rows[0]);
  }));

  router.get('/:id', ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM mh_campaigns WHERE id=$1 AND organization_id=$2 AND kind=$3`,
      [req.params.id, req.user.organizationId, kind]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  }));

  router.put('/:id', canWrite, ah(async (req, res) => {
    const { name, channel, objective, audience_id, message_body, budget_amount, start_date, end_date, scheduled_at, status } = req.body;
    if (channel && kind === 'broadcast' && channel === 'linkedin') {
      return res.status(400).json({ error: 'LinkedIn does not support broadcasts — campaigns only.' });
    }
    const { rows } = await pool.query(
      `UPDATE mh_campaigns SET
         name=COALESCE($1,name), channel=COALESCE($2,channel), objective=COALESCE($3,objective),
         audience_id=COALESCE($4,audience_id), message_body=COALESCE($5,message_body),
         budget_amount=COALESCE($6,budget_amount), start_date=COALESCE($7,start_date),
         end_date=COALESCE($8,end_date), scheduled_at=COALESCE($9,scheduled_at),
         status=COALESCE($10,status), updated_at=now()
       WHERE id=$11 AND organization_id=$12 AND kind=$13 RETURNING *`,
      [name, channel, objective, audience_id, message_body, budget_amount, start_date, end_date, scheduled_at, status,
       req.params.id, req.user.organizationId, kind]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    logAudit(req, `mh_${kind}.update`, { id: req.params.id, changes: { name, status } });
    res.json(rows[0]);
  }));

  router.delete('/:id', canWrite, ah(async (req, res) => {
    await pool.query(`DELETE FROM mh_campaigns WHERE id=$1 AND organization_id=$2 AND kind=$3`,
      [req.params.id, req.user.organizationId, kind]);
    logAudit(req, `mh_${kind}.delete`, { id: req.params.id });
    res.json({ ok: true });
  }));

  // Pause/Resume/Archive from the list toolbar — a plain status write, no
  // send/queue side effects.
  router.post('/:id/status', canWrite, ah(async (req, res) => {
    const { status } = req.body;
    const ALLOWED = ['draft', 'paused', 'processing', 'archived'];
    if (!ALLOWED.includes(status)) return res.status(400).json({ error: `status must be one of: ${ALLOWED.join(', ')}` });
    const { rows } = await pool.query(
      `UPDATE mh_campaigns SET status=$1, updated_at=now() WHERE id=$2 AND organization_id=$3 AND kind=$4 RETURNING *`,
      [status, req.params.id, req.user.organizationId, kind]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    logAudit(req, `mh_${kind}.status_change`, { id: req.params.id, status });
    res.json(rows[0]);
  }));

  /**
   * Resolves the audience against contact-service, bulk-inserts
   * mh_recipients, and enqueues them — mirrors campaign-service's
   * POST /campaigns/broadcast transaction shape (insert-then-enqueue, only
   * after COMMIT so a worker never picks up a job for a row that doesn't
   * durably exist yet).
   */
  router.post('/:id/publish', canSend, ah(async (req, res) => {
    const { rows: campaignRows } = await pool.query(
      `SELECT * FROM mh_campaigns WHERE id=$1 AND organization_id=$2 AND kind=$3`,
      [req.params.id, req.user.organizationId, kind]
    );
    const campaign = campaignRows[0];
    if (!campaign) return res.status(404).json({ error: 'not found' });
    if (kind === 'broadcast' && campaign.channel === 'linkedin') {
      return res.status(400).json({ error: 'LinkedIn does not support broadcasts — campaigns only.' });
    }
    if (!campaign.audience_id) return res.status(400).json({ error: 'Set an audience before publishing.' });
    if (!campaign.message_body?.trim()) return res.status(400).json({ error: 'Set a message before publishing.' });

    const { rows: audienceRows } = await pool.query(
      `SELECT * FROM mh_audiences WHERE id=$1 AND organization_id=$2`,
      [campaign.audience_id, req.user.organizationId]
    );
    const audience = audienceRows[0];
    if (!audience) return res.status(400).json({ error: 'Audience not found.' });

    const recipients = await resolveRecipients(audience.filter, campaign.channel, req.headers.authorization);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'This audience has no contacts reachable on this channel.' });
    }

    let recipientRows;
    try {
      await pool.query('BEGIN');

      const ids = recipients.map((r) => r.contactId);
      const destinations = recipients.map((r) => r.destination);
      const names = recipients.map((r) => r.displayName);

      const { rows } = await pool.query(
        `INSERT INTO mh_recipients (campaign_id, contact_id, channel, destination, display_name, rendered_message)
         SELECT $1, i::uuid, $2, d, n, $3
           FROM UNNEST($4::text[], $5::text[], $6::text[]) AS t(i, d, n)
         ON CONFLICT (campaign_id, destination) DO NOTHING
         RETURNING id, channel, destination, display_name, rendered_message`,
        [campaign.id, campaign.channel, campaign.message_body, ids, destinations, names]
      );
      recipientRows = rows;

      await pool.query(
        `UPDATE mh_campaigns SET status='processing', total_recipients=$1, scheduled_at=COALESCE(scheduled_at, now()), updated_at=now() WHERE id=$2`,
        [recipientRows.length, campaign.id]
      );

      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    logAudit(req, `mh_${kind}.publish`, { id: campaign.id, name: campaign.name, recipientCount: recipientRows.length });

    const enqueued = await enqueueRecipients(campaign.id, recipientRows, {
      throttlePerMinute: 120,
      scheduledAt: campaign.scheduled_at,
    });

    res.json({
      campaign: { ...campaign, status: 'processing', total_recipients: recipientRows.length },
      queuedRecipients: enqueued.length,
    });
  }));

  // Heuristic (non-LLM, zero-dependency) budget/audience suggestion off the
  // campaign's own real metrics — same "generate from real DB numbers, not
  // a canned string" rule the rest of this service follows (see aeo.js).
  // Kept in-process rather than calling an external LLM so this route has
  // no new env vars / network dependency to wire up in docker-compose.
  router.post('/:id/optimize', canWrite, ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM mh_campaigns WHERE id=$1 AND organization_id=$2 AND kind=$3`,
      [req.params.id, req.user.organizationId, kind]
    );
    const c = rows[0];
    if (!c) return res.status(404).json({ error: 'not found' });

    const total = c.total_recipients || 0;
    const failRate = total > 0 ? (c.failed_count || 0) / total : 0;
    const readRate = (c.delivered_count || 0) > 0 ? (c.read_count || 0) / c.delivered_count : 0;
    const replyRate = (c.read_count || 0) > 0 ? (c.replied_count || 0) / c.read_count : 0;

    const suggestions = [];
    if (total === 0) {
      suggestions.push({ field: 'audience_id', action: 'Attach an audience before publishing — this campaign has no recipients yet.' });
    }
    if (failRate > 0.15) {
      suggestions.push({ field: 'audience_id', action: `${Math.round(failRate * 100)}% of sends failed — refresh contact details for this audience or pick a cleaner list.` });
    }
    if (total > 0 && readRate < 0.3) {
      suggestions.push({ field: 'message_body', action: 'Read rate is low — try a shorter opening line or a clearer subject/first sentence.' });
    }
    if (total > 0 && readRate >= 0.3 && replyRate < 0.05) {
      suggestions.push({ field: 'message_body', action: 'Being read but not replied to — add a direct question or single clear call-to-action.' });
    }
    if (c.budget_amount && total > 0 && Number(c.budget_amount) / total > 50) {
      const suggestedBudget = Math.round(total * 30);
      suggestions.push({ field: 'budget_amount', action: `Budget per recipient looks high for this audience size — consider ~₹${suggestedBudget.toLocaleString()} instead.`, suggested_value: suggestedBudget });
    }
    if (suggestions.length === 0) {
      suggestions.push({ field: null, action: total === 0 ? 'Not enough data yet — check back once this campaign has recipients.' : 'Performance looks healthy — no changes suggested right now.' });
    }

    res.json({ campaignId: c.id, generatedAt: new Date().toISOString(), metrics: { total, failRate, readRate, replyRate }, suggestions });
  }));

  // Per-recipient status list for a detail drawer's diagnostics view — the
  // aggregate counters on the campaign row itself are enough for a live
  // progress bar alone.
  router.get('/:id/recipients', ah(async (req, res) => {
    const { rows: owned } = await pool.query(
      `SELECT id FROM mh_campaigns WHERE id=$1 AND organization_id=$2 AND kind=$3`,
      [req.params.id, req.user.organizationId, kind]
    );
    if (!owned[0]) return res.status(404).json({ error: 'not found' });

    const { rows } = await pool.query(
      `SELECT id, destination, display_name, status, error, attempts, sent_at, delivered_at, read_at, replied_at
         FROM mh_recipients WHERE campaign_id=$1 ORDER BY updated_at DESC LIMIT 500`,
      [req.params.id]
    );
    res.json(rows);
  }));

  return router;
}

module.exports = { buildRouter, CHANNELS };
