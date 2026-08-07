const express = require('express');
const { pool, requirePermission, logAudit } = require('@lead/shared');
const { estimateSize, fetchTagOptions } = require('../services/audienceResolver');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const canWrite = requirePermission('campaigns:write');

const router = express.Router();

router.get('/', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM mh_audiences WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 500`,
    [req.user.organizationId]
  );
  res.json(rows);
}));

// Mounted before /:id so it isn't swallowed by that param route.
router.get('/tag-options', ah(async (req, res) => {
  const options = await fetchTagOptions(req.headers.authorization);
  res.json(options); // [{ tag, contact_count }] — straight from contact-service
}));

router.post('/', canWrite, ah(async (req, res) => {
  const { name, source, filter } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  const { rows } = await pool.query(
    `INSERT INTO mh_audiences (organization_id, name, source, filter, created_by)
     VALUES ($1,$2,COALESCE($3,'custom'),$4,$5) RETURNING *`,
    [req.user.organizationId, name, source, JSON.stringify(filter || {}), req.user.userId]
  );
  logAudit(req, 'mh_audience.create', { id: rows[0].id, name });
  res.status(201).json(rows[0]);
}));

router.get('/:id', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM mh_audiences WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

router.put('/:id', canWrite, ah(async (req, res) => {
  const { name, source, filter, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE mh_audiences SET name=COALESCE($1,name), source=COALESCE($2,source),
            filter=COALESCE($3,filter), status=COALESCE($4,status), updated_at=now()
      WHERE id=$5 AND organization_id=$6 RETURNING *`,
    [name, source, filter ? JSON.stringify(filter) : null, status, req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  logAudit(req, 'mh_audience.update', { id: req.params.id, changes: { name } });
  res.json(rows[0]);
}));

router.delete('/:id', canWrite, ah(async (req, res) => {
  await pool.query(`DELETE FROM mh_audiences WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  logAudit(req, 'mh_audience.delete', { id: req.params.id });
  res.json({ ok: true });
}));

// Real, derived estimate — resolves against contact-service, never a
// fabricated number. Cached on the row with its own timestamp so the UI can
// show the estimate's age, same convention as the rest of this codebase's
// "cached estimate, not a live count" fields.
router.post('/:id/estimate-size', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM mh_audiences WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  const audience = rows[0];
  if (!audience) return res.status(404).json({ error: 'not found' });

  const size = await estimateSize(audience.filter, req.headers.authorization);
  const { rows: updated } = await pool.query(
    `UPDATE mh_audiences SET size_cached=$1, size_computed_at=now() WHERE id=$2 RETURNING *`,
    [size, req.params.id]
  );
  res.json(updated[0]);
}));

module.exports = router;
