// src/broadcasts.js
//
// Marketing Hub Broadcasts — one-to-many sends (WhatsApp / Email / SMS)
// with delivery funnel metrics and optional AI score.
//
// DECISION (Task 5 of 6 — delivery reuse vs new sender):
// ---------------------------------------------------------------------------
// campaign-service already has:
//   - message templates (WhatsApp / RCS / SMS / Email)
//   - BullMQ bulk-campaign queue + worker (SMS/RCS)
//
// That worker *simulates* carrier delivery because no outbound SMS/WhatsApp
// provider is wired anywhere in the monorepo yet (see
// services/campaign-service/src/services/bulkCampaignWorker.js header).
// The queue is also tightly bound to campaign-service's own `campaigns` and
// `campaign_recipients` tables.
//
// Mapping Marketing Hub broadcasts into that schema would:
//   1. Pollute the outbound-campaigns product surface with Hub rows
//   2. Still only simulate delivery
//
// So marketing-hub-service owns marketing_broadcasts end-to-end. The
// POST /:id/send endpoint performs the same simulation convention
// (audience-size-based metrics, short async latency) and updates the
// broadcast row. When a real channel provider is attached to
// campaign-service later, replace the simulate block below — do not
// build a second real sender.
// ---------------------------------------------------------------------------
//
// Mounted behind `authenticate` in index.js. Tenant-scoped via
// organization_id + RLS (app.current_org).

const express = require('express');
const { pool } = require('@lead/shared');

const router = express.Router();

const CHANNELS = new Set(['WhatsApp', 'Email', 'SMS']);
const STATUSES = new Set(['Draft', 'Scheduled', 'Active', 'Sent']);

const SELECT_COLS = `
  b.id, b.organization_id, b.name, b.channel, b.audience_id,
  b.status, b.sent, b.delivered, b.opened, b.clicked, b.responses,
  b.conversion, b.ai_score, b.message_body,
  b.scheduled_at, b.sent_at, b.created_at, b.updated_at,
  a.name AS audience_name, a.size AS audience_size
`;

const FROM_JOIN = `
  FROM marketing_broadcasts b
  LEFT JOIN marketing_audiences a ON a.id = b.audience_id
`;

function num(v, fallback = 0) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function intOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r) {
  if (!r) return r;
  return {
    id: r.id,
    organization_id: r.organization_id,
    name: r.name,
    channel: r.channel,
    audience_id: r.audience_id,
    audience: r.audience_name
      ? `${r.audience_name}${r.audience_size != null ? ` (${Number(r.audience_size).toLocaleString()})` : ''}`
      : null,
    audience_name: r.audience_name || null,
    audience_size: r.audience_size != null ? Number(r.audience_size) : null,
    status: r.status,
    sent: Number(r.sent) || 0,
    delivered: Number(r.delivered) || 0,
    opened: Number(r.opened) || 0,
    clicked: Number(r.clicked) || 0,
    responses: Number(r.responses) || 0,
    conversion: Number(r.conversion) || 0,
    ai_score: r.ai_score != null ? Number(r.ai_score) : null,
    aiScore: r.ai_score != null ? Number(r.ai_score) : null,
    message_body: r.message_body || null,
    scheduled_at: r.scheduled_at,
    sent_at: r.sent_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/**
 * Simulated channel delivery — mirrors campaign-service's
 * simulateProviderSend convention. Derives funnel metrics from audience size
 * so the UI has realistic sent/delivered/opened/clicked numbers after /send.
 */
function simulateDelivery(audienceSize, channel) {
  const size = Math.max(0, Math.round(Number(audienceSize) || 0));
  // If audience has no size yet, treat as a small test blast.
  const target = size > 0 ? size : 100;

  const deliveredRate =
    channel === 'WhatsApp' ? 0.95 : channel === 'SMS' ? 0.97 : 0.92;
  const openedRate =
    channel === 'WhatsApp' ? 0.78 : channel === 'SMS' ? 0.65 : 0.42;
  const clickedRate =
    channel === 'WhatsApp' ? 0.28 : channel === 'SMS' ? 0.18 : 0.12;
  const responseRate =
    channel === 'WhatsApp' ? 0.12 : channel === 'SMS' ? 0.05 : 0.03;
  const conversionRate =
    channel === 'WhatsApp' ? 0.08 : channel === 'SMS' ? 0.04 : 0.025;

  const sent = target;
  const delivered = Math.round(sent * deliveredRate);
  const opened = Math.round(delivered * openedRate);
  const clicked = Math.round(opened * clickedRate);
  const responses = Math.round(opened * responseRate);
  const conversion = Math.round(conversionRate * 1000) / 10; // one decimal %

  return { sent, delivered, opened, clicked, responses, conversion };
}

// GET /marketing-hub/broadcasts?status=&channel=
router.get('/marketing-hub/broadcasts', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { status, channel } = req.query;
    const params = [orgId];
    let sql = `
      SELECT ${SELECT_COLS}
      ${FROM_JOIN}
       WHERE b.organization_id = $1
    `;
    if (status && status !== 'All' && STATUSES.has(status)) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }
    if (channel && channel !== 'All' && CHANNELS.has(channel)) {
      params.push(channel);
      sql += ` AND b.channel = $${params.length}`;
    }
    sql += ` ORDER BY b.created_at DESC LIMIT 500`;

    const { rows } = await pool.query(sql, params);
    res.json(rows.map(mapRow));
  } catch (err) {
    console.error('[marketing-hub] list broadcasts', err);
    res.status(500).json({ error: err.message || 'Failed to list broadcasts' });
  }
});

// GET /marketing-hub/broadcasts/:id
router.get('/marketing-hub/broadcasts/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS}
       ${FROM_JOIN}
        WHERE b.id = $1 AND b.organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Broadcast not found' });
    res.json(mapRow(rows[0]));
  } catch (err) {
    console.error('[marketing-hub] get broadcast', err);
    res.status(500).json({ error: err.message || 'Failed to get broadcast' });
  }
});

// POST /marketing-hub/broadcasts — create (status starts 'Draft')
router.post('/marketing-hub/broadcasts', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const b = req.body || {};

    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!b.channel || !CHANNELS.has(b.channel)) {
      return res.status(400).json({
        error: `channel must be one of: ${[...CHANNELS].join(', ')}`,
      });
    }

    let audienceId = b.audience_id || b.audienceId || null;
    if (audienceId) {
      const { rows: aud } = await pool.query(
        `SELECT id FROM marketing_audiences
          WHERE id = $1 AND organization_id = $2`,
        [audienceId, orgId]
      );
      if (!aud[0]) {
        return res.status(400).json({ error: 'audience_id not found in this organization' });
      }
    }

    const status = b.status && STATUSES.has(b.status) ? b.status : 'Draft';
    const aiScore = intOrNull(b.ai_score ?? b.aiScore);
    if (aiScore !== null && (aiScore < 0 || aiScore > 100)) {
      return res.status(400).json({ error: 'ai_score must be 0–100' });
    }

    const { rows } = await pool.query(
      `INSERT INTO marketing_broadcasts (
         organization_id, name, channel, audience_id, status,
         sent, delivered, opened, clicked, responses, conversion, ai_score,
         message_body, scheduled_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11, $12,
         $13, $14
       )
       RETURNING id`,
      [
        orgId,
        String(b.name).trim(),
        b.channel,
        audienceId,
        status,
        Math.round(num(b.sent)),
        Math.round(num(b.delivered)),
        Math.round(num(b.opened)),
        Math.round(num(b.clicked)),
        Math.round(num(b.responses)),
        num(b.conversion),
        aiScore,
        b.message_body || b.messageBody || null,
        b.scheduled_at || b.scheduledAt || null,
      ]
    );

    const { rows: full } = await pool.query(
      `SELECT ${SELECT_COLS} ${FROM_JOIN} WHERE b.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(mapRow(full[0]));
  } catch (err) {
    console.error('[marketing-hub] create broadcast', err);
    res.status(500).json({ error: err.message || 'Failed to create broadcast' });
  }
});

// POST /marketing-hub/broadcasts/:id/send
// Triggers simulated channel delivery and updates funnel metrics.
// See file header for the campaign-service reuse decision.
router.post('/marketing-hub/broadcasts/:id/send', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { rows: existing } = await pool.query(
      `SELECT ${SELECT_COLS}
       ${FROM_JOIN}
        WHERE b.id = $1 AND b.organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Broadcast not found' });

    const row = existing[0];
    if (row.status === 'Sent') {
      return res.status(400).json({ error: 'Broadcast already sent' });
    }

    // Simulate channel hop (same spirit as campaign-service bulk worker).
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));

    const metrics = simulateDelivery(row.audience_size, row.channel);
    const body = (req.body && (req.body.message_body || req.body.messageBody)) || row.message_body;

    const { rows } = await pool.query(
      `UPDATE marketing_broadcasts
          SET status = 'Sent',
              sent = $1,
              delivered = $2,
              opened = $3,
              clicked = $4,
              responses = $5,
              conversion = $6,
              message_body = COALESCE($7, message_body),
              sent_at = now(),
              updated_at = now()
        WHERE id = $8 AND organization_id = $9
        RETURNING id`,
      [
        metrics.sent,
        metrics.delivered,
        metrics.opened,
        metrics.clicked,
        metrics.responses,
        metrics.conversion,
        body || null,
        req.params.id,
        orgId,
      ]
    );

    const { rows: full } = await pool.query(
      `SELECT ${SELECT_COLS} ${FROM_JOIN} WHERE b.id = $1`,
      [rows[0].id]
    );

    console.log(
      `[marketing-hub] broadcast ${rows[0].id} sent via ${row.channel} ` +
        `(simulated ${metrics.sent} recipients, audience=${row.audience_name || 'none'})`
    );

    res.json({
      ...mapRow(full[0]),
      _delivery: {
        mode: 'simulated',
        channel: row.channel,
        note:
          'Delivery uses the same simulation convention as campaign-service ' +
          'bulkCampaignWorker (no real carrier/WhatsApp provider is wired). ' +
          'Metrics derived from audience size.',
      },
    });
  } catch (err) {
    console.error('[marketing-hub] send broadcast', err);
    res.status(500).json({ error: err.message || 'Failed to send broadcast' });
  }
});

// PATCH /marketing-hub/broadcasts/:id
router.patch('/marketing-hub/broadcasts/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const b = req.body || {};

    const { rows: existing } = await pool.query(
      `SELECT id FROM marketing_broadcasts WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Broadcast not found' });

    const sets = [];
    const params = [];
    const set = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (b.name !== undefined) set('name', String(b.name).trim());
    if (b.channel !== undefined) {
      if (!CHANNELS.has(b.channel)) {
        return res.status(400).json({ error: 'invalid channel' });
      }
      set('channel', b.channel);
    }
    if (b.audience_id !== undefined || b.audienceId !== undefined) {
      const aid = b.audience_id ?? b.audienceId;
      if (aid) {
        const { rows: aud } = await pool.query(
          `SELECT id FROM marketing_audiences WHERE id = $1 AND organization_id = $2`,
          [aid, orgId]
        );
        if (!aud[0]) {
          return res.status(400).json({ error: 'audience_id not found in this organization' });
        }
      }
      set('audience_id', aid || null);
    }
    if (b.status !== undefined) {
      if (!STATUSES.has(b.status)) {
        return res.status(400).json({ error: 'invalid status' });
      }
      set('status', b.status);
    }
    if (b.sent !== undefined) set('sent', Math.round(num(b.sent)));
    if (b.delivered !== undefined) set('delivered', Math.round(num(b.delivered)));
    if (b.opened !== undefined) set('opened', Math.round(num(b.opened)));
    if (b.clicked !== undefined) set('clicked', Math.round(num(b.clicked)));
    if (b.responses !== undefined) set('responses', Math.round(num(b.responses)));
    if (b.conversion !== undefined) set('conversion', num(b.conversion));
    if (b.message_body !== undefined || b.messageBody !== undefined) {
      set('message_body', b.message_body ?? b.messageBody ?? null);
    }
    if (b.scheduled_at !== undefined || b.scheduledAt !== undefined) {
      set('scheduled_at', b.scheduled_at ?? b.scheduledAt ?? null);
    }
    if (b.sent_at !== undefined || b.sentAt !== undefined) {
      set('sent_at', b.sent_at ?? b.sentAt ?? null);
    }
    if (b.ai_score !== undefined || b.aiScore !== undefined) {
      const ai = intOrNull(b.ai_score ?? b.aiScore);
      if (ai !== null && (ai < 0 || ai > 100)) {
        return res.status(400).json({ error: 'ai_score must be 0–100' });
      }
      set('ai_score', ai);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    sets.push('updated_at = now()');
    params.push(req.params.id, orgId);

    await pool.query(
      `UPDATE marketing_broadcasts
          SET ${sets.join(', ')}
        WHERE id = $${params.length - 1} AND organization_id = $${params.length}`,
      params
    );

    const { rows: full } = await pool.query(
      `SELECT ${SELECT_COLS} ${FROM_JOIN} WHERE b.id = $1`,
      [req.params.id]
    );
    res.json(mapRow(full[0]));
  } catch (err) {
    console.error('[marketing-hub] patch broadcast', err);
    res.status(500).json({ error: err.message || 'Failed to update broadcast' });
  }
});

// DELETE /marketing-hub/broadcasts/:id
router.delete('/marketing-hub/broadcasts/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { rows } = await pool.query(
      `DELETE FROM marketing_broadcasts
        WHERE id = $1 AND organization_id = $2
        RETURNING id`,
      [req.params.id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Broadcast not found' });
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('[marketing-hub] delete broadcast', err);
    res.status(500).json({ error: err.message || 'Failed to delete broadcast' });
  }
});

module.exports = router;
