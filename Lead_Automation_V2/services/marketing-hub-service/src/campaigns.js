// src/campaigns.js
//
// Marketing Hub Campaigns — ad-platform campaign tracking (Facebook / Google
// Ads / LinkedIn / Instagram / WhatsApp / Email spend & performance).
//
// DECISION (Task 4 of 6): metrics (spend, reach, CTR, CPM, CPC, leads,
// conversions, revenue, ROAS) are MANUALLY ENTERED via simple CRUD forms.
// No Meta Ads API / Google Ads API OAuth or webhook/sync plumbing is
// implemented — platform credentials and integration requirements were not
// provided. Metrics are also not computed from contact-service lead data;
// this page is an operator-maintained performance ledger, not a live ad
// platform mirror.
//
// SEPARATION: deliberately separate from campaign-service's `campaigns`
// table (WhatsApp/SMS/email template-based outbound broadcasts). Do not
// merge the concepts — different product surfaces, different schemas.
//
// Mounted behind `authenticate` in index.js. Tenant-scoped via
// organization_id + RLS (app.current_org).

const express = require('express');
const { pool } = require('@lead/shared');

const router = express.Router();

const PLATFORMS = new Set([
  'Facebook', 'Google Ads', 'LinkedIn', 'Instagram', 'WhatsApp', 'Email',
]);
const STATUSES = new Set(['Active', 'Scheduled', 'Paused', 'Draft']);

const SELECT_COLS = `
  id, organization_id, name, platform, objective, status,
  budget, spend, ctr, cpm, cpc, reach, impressions,
  leads, conversions, revenue, roas,
  created_by, start_date, end_date, ai_score,
  created_at, updated_at
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

// GET /marketing-hub/campaigns?status=&platform=
router.get('/marketing-hub/campaigns', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { status, platform } = req.query;
    const params = [orgId];
    let sql = `
      SELECT ${SELECT_COLS}
        FROM marketing_campaigns
       WHERE organization_id = $1
    `;
    if (status && status !== 'All' && STATUSES.has(status)) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (platform && platform !== 'All' && PLATFORMS.has(platform)) {
      params.push(platform);
      sql += ` AND platform = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT 500`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[marketing-hub] list campaigns', err);
    res.status(500).json({ error: err.message || 'Failed to list campaigns' });
  }
});

// GET /marketing-hub/campaigns/:id
router.get('/marketing-hub/campaigns/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS}
         FROM marketing_campaigns
        WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[marketing-hub] get campaign', err);
    res.status(500).json({ error: err.message || 'Failed to get campaign' });
  }
});

// POST /marketing-hub/campaigns
router.post('/marketing-hub/campaigns', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user.userId;
    const b = req.body || {};

    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!b.platform || !PLATFORMS.has(b.platform)) {
      return res.status(400).json({
        error: `platform must be one of: ${[...PLATFORMS].join(', ')}`,
      });
    }
    const status = b.status && STATUSES.has(b.status) ? b.status : 'Draft';
    const aiScore = intOrNull(b.ai_score ?? b.aiScore);
    if (aiScore !== null && (aiScore < 0 || aiScore > 100)) {
      return res.status(400).json({ error: 'ai_score must be 0–100' });
    }

    const { rows } = await pool.query(
      `INSERT INTO marketing_campaigns (
         organization_id, name, platform, objective, status,
         budget, spend, ctr, cpm, cpc, reach, impressions,
         leads, conversions, revenue, roas,
         created_by, start_date, end_date, ai_score
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16,
         $17, $18, $19, $20
       )
       RETURNING ${SELECT_COLS}`,
      [
        orgId,
        String(b.name).trim(),
        b.platform,
        b.objective || null,
        status,
        num(b.budget),
        num(b.spend),
        num(b.ctr),
        num(b.cpm),
        num(b.cpc),
        num(b.reach),
        num(b.impressions),
        Math.round(num(b.leads)),
        Math.round(num(b.conversions)),
        num(b.revenue),
        num(b.roas),
        userId || null,
        b.start_date || b.startDate || null,
        b.end_date || b.endDate || null,
        aiScore,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[marketing-hub] create campaign', err);
    res.status(500).json({ error: err.message || 'Failed to create campaign' });
  }
});

// PATCH /marketing-hub/campaigns/:id — status, budget, metrics edits
router.patch('/marketing-hub/campaigns/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const b = req.body || {};

    const { rows: existing } = await pool.query(
      `SELECT id FROM marketing_campaigns WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Campaign not found' });

    const sets = [];
    const params = [];
    const set = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (b.name !== undefined) set('name', String(b.name).trim());
    if (b.platform !== undefined) {
      if (!PLATFORMS.has(b.platform)) {
        return res.status(400).json({ error: 'invalid platform' });
      }
      set('platform', b.platform);
    }
    if (b.objective !== undefined) set('objective', b.objective || null);
    if (b.status !== undefined) {
      if (!STATUSES.has(b.status)) {
        return res.status(400).json({ error: 'invalid status' });
      }
      set('status', b.status);
    }
    if (b.budget !== undefined) set('budget', num(b.budget));
    if (b.spend !== undefined) set('spend', num(b.spend));
    if (b.ctr !== undefined) set('ctr', num(b.ctr));
    if (b.cpm !== undefined) set('cpm', num(b.cpm));
    if (b.cpc !== undefined) set('cpc', num(b.cpc));
    if (b.reach !== undefined) set('reach', num(b.reach));
    if (b.impressions !== undefined) set('impressions', num(b.impressions));
    if (b.leads !== undefined) set('leads', Math.round(num(b.leads)));
    if (b.conversions !== undefined) set('conversions', Math.round(num(b.conversions)));
    if (b.revenue !== undefined) set('revenue', num(b.revenue));
    if (b.roas !== undefined) set('roas', num(b.roas));
    if (b.start_date !== undefined || b.startDate !== undefined) {
      set('start_date', b.start_date ?? b.startDate ?? null);
    }
    if (b.end_date !== undefined || b.endDate !== undefined) {
      set('end_date', b.end_date ?? b.endDate ?? null);
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

    const { rows } = await pool.query(
      `UPDATE marketing_campaigns
          SET ${sets.join(', ')}
        WHERE id = $${params.length - 1} AND organization_id = $${params.length}
        RETURNING ${SELECT_COLS}`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[marketing-hub] patch campaign', err);
    res.status(500).json({ error: err.message || 'Failed to update campaign' });
  }
});

// DELETE /marketing-hub/campaigns/:id
router.delete('/marketing-hub/campaigns/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { rows } = await pool.query(
      `DELETE FROM marketing_campaigns
        WHERE id = $1 AND organization_id = $2
        RETURNING id`,
      [req.params.id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('[marketing-hub] delete campaign', err);
    res.status(500).json({ error: err.message || 'Failed to delete campaign' });
  }
});

module.exports = router;