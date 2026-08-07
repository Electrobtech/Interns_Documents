// src/audiences.js
//
// Marketing Hub Audiences — named marketing audiences with source, score,
// status, filter_definition, and growth snapshots.
//
// Distinct from contact-service tag-based segments (GET /contacts/segments).
// See migrations/033_marketing_audiences.sql.
//
// Mounted behind `authenticate` in index.js.

const express = require('express');
const { pool } = require('@lead/shared');

const router = express.Router();

const SOURCES = new Set(['Custom', 'Pixel', 'Lookalike', 'Import', 'CRM']);
const STATUSES = new Set(['Active', 'Archived']);

const SELECT_COLS = `
  id, organization_id, name, source, size, score, status,
  filter_definition, created_at, updated_at
`;

// GET /marketing-hub/audiences?status=
router.get('/marketing-hub/audiences', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { status } = req.query;
    const params = [orgId];
    let sql = `
      SELECT ${SELECT_COLS}
        FROM marketing_audiences
       WHERE organization_id = $1
    `;
    if (status && status !== 'All' && STATUSES.has(status)) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[marketing-hub] list audiences', err);
    res.status(500).json({ error: err.message || 'Failed to list audiences' });
  }
});

// GET /marketing-hub/audiences/growth?weeks=8
// Aggregate weekly size snapshots across all org audiences for the growth chart.
router.get('/marketing-hub/audiences/growth', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const weeks = Math.min(52, Math.max(1, parseInt(req.query.weeks, 10) || 8));
    const { rows } = await pool.query(
      `SELECT date_trunc('week', s.captured_at)::date AS week,
              SUM(s.size)::bigint AS size
         FROM marketing_audience_snapshots s
         JOIN marketing_audiences a ON a.id = s.audience_id
        WHERE a.organization_id = $1
          AND s.captured_at >= now() - ($2 || ' weeks')::interval
        GROUP BY 1
        ORDER BY 1 ASC`,
      [orgId, String(weeks)]
    );
    res.json(rows.map((r) => ({
      week: r.week,
      size: Number(r.size) || 0,
      label: r.week ? new Date(r.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    })));
  } catch (err) {
    console.error('[marketing-hub] audience growth', err);
    res.status(500).json({ error: err.message || 'Failed to load growth' });
  }
});

// GET /marketing-hub/audiences/:id
router.get('/marketing-hub/audiences/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS}
         FROM marketing_audiences
        WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Audience not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[marketing-hub] get audience', err);
    res.status(500).json({ error: err.message || 'Failed to get audience' });
  }
});

// POST /marketing-hub/audiences
router.post('/marketing-hub/audiences', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const source = b.source && SOURCES.has(b.source) ? b.source : 'Custom';
    const status = b.status && STATUSES.has(b.status) ? b.status : 'Active';
    const size = Math.max(0, parseInt(b.size, 10) || 0);
    let score = b.score === undefined || b.score === null || b.score === ''
      ? null
      : parseInt(b.score, 10);
    if (score !== null && !Number.isFinite(score)) score = null;

    const { rows } = await pool.query(
      `INSERT INTO marketing_audiences (
         organization_id, name, source, size, score, status, filter_definition
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING ${SELECT_COLS}`,
      [
        orgId,
        String(b.name).trim(),
        source,
        size,
        score,
        status,
        JSON.stringify(b.filter_definition || b.filterDefinition || {}),
      ]
    );

    // Seed an initial growth snapshot so charts are not empty.
    await pool.query(
      `INSERT INTO marketing_audience_snapshots (audience_id, size)
       VALUES ($1, $2)`,
      [rows[0].id, size]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[marketing-hub] create audience', err);
    res.status(500).json({ error: err.message || 'Failed to create audience' });
  }
});

// PATCH /marketing-hub/audiences/:id
router.patch('/marketing-hub/audiences/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const b = req.body || {};

    const { rows: existing } = await pool.query(
      `SELECT id FROM marketing_audiences WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Audience not found' });

    const sets = [];
    const params = [];
    const set = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (b.name !== undefined) set('name', String(b.name).trim());
    if (b.source !== undefined) {
      if (!SOURCES.has(b.source)) return res.status(400).json({ error: 'invalid source' });
      set('source', b.source);
    }
    if (b.status !== undefined) {
      if (!STATUSES.has(b.status)) return res.status(400).json({ error: 'invalid status' });
      set('status', b.status);
    }
    if (b.size !== undefined) set('size', Math.max(0, parseInt(b.size, 10) || 0));
    if (b.score !== undefined) {
      const score = b.score === null || b.score === '' ? null : parseInt(b.score, 10);
      set('score', Number.isFinite(score) ? score : null);
    }
    if (b.filter_definition !== undefined || b.filterDefinition !== undefined) {
      params.push(JSON.stringify(b.filter_definition ?? b.filterDefinition ?? {}));
      sets.push(`filter_definition = $${params.length}::jsonb`);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    sets.push('updated_at = now()');
    params.push(req.params.id, orgId);

    const { rows } = await pool.query(
      `UPDATE marketing_audiences
          SET ${sets.join(', ')}
        WHERE id = $${params.length - 1} AND organization_id = $${params.length}
        RETURNING ${SELECT_COLS}`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[marketing-hub] patch audience', err);
    res.status(500).json({ error: err.message || 'Failed to update audience' });
  }
});

// DELETE /marketing-hub/audiences/:id
router.delete('/marketing-hub/audiences/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { rows } = await pool.query(
      `DELETE FROM marketing_audiences
        WHERE id = $1 AND organization_id = $2
        RETURNING id`,
      [req.params.id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Audience not found' });
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('[marketing-hub] delete audience', err);
    res.status(500).json({ error: err.message || 'Failed to delete audience' });
  }
});

module.exports = router;