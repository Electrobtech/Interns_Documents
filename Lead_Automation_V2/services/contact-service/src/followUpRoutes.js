const express = require('express');
const { pool, requirePermission, logAudit } = require('@lead/shared');

const router = express.Router();

// Follow-ups piggyback on the same permission set as Contacts & Leads
// (contacts:write / contacts:delete) rather than minting a brand-new
// permission code — every role that can already edit a contact/lead can
// also manage its follow-up reminders, and this avoids needing a fresh
// role_permissions seed row just for this feature (see infra/db/seed.sql).
const canWrite = requirePermission('contacts:write');
const canDelete = requirePermission('contacts:delete');

const SELECT_FOLLOW_UP = `
  SELECT f.*, c.name AS contact_name, c.phone AS contact_phone, c.email AS contact_email,
         u.name AS assigned_to_name
    FROM follow_ups f
    JOIN contacts c ON c.id = f.contact_id
    LEFT JOIN users u ON u.id = f.assigned_to
`;

// GET /follow-ups?bucket=overdue|today|upcoming|all&status=&assigned_to=&contact_id=
//
// `bucket` is the tab selector the Follow-ups page's table/view uses
// (overdue / today / upcoming / all) — computed off `due_at` relative to
// "now" rather than a stored bucket column, so a row moves buckets on its
// own as time passes without any batch job needing to update it.
router.get('/follow-ups', async (req, res) => {
  const { bucket, status, assigned_to, contact_id } = req.query;
  const where = ['f.organization_id = $1'];
  const params = [req.user.organizationId];

  if (bucket === 'overdue') {
    where.push(`f.status = 'pending' AND f.due_at < now()`);
  } else if (bucket === 'today') {
    where.push(`f.status = 'pending' AND f.due_at >= date_trunc('day', now()) AND f.due_at < date_trunc('day', now()) + interval '1 day'`);
  } else if (bucket === 'upcoming') {
    where.push(`f.status = 'pending' AND f.due_at >= date_trunc('day', now()) + interval '1 day'`);
  }
  // bucket === 'all' (or omitted): no extra due_at filter.

  if (status) {
    params.push(status);
    where.push(`f.status = $${params.length}`);
  }
  if (assigned_to) {
    params.push(assigned_to);
    where.push(`f.assigned_to = $${params.length}`);
  }
  if (contact_id) {
    params.push(contact_id);
    where.push(`f.contact_id = $${params.length}`);
  }

  const { rows } = await pool.query(
    `${SELECT_FOLLOW_UP} WHERE ${where.join(' AND ')} ORDER BY f.due_at ASC LIMIT 500`,
    params
  );
  res.json(rows);
});

// GET /follow-ups/counts — badge counts for the Follow-ups page's tab bar.
router.get('/follow-ups/counts', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending' AND due_at < now())::int AS overdue,
       COUNT(*) FILTER (WHERE status = 'pending' AND due_at >= date_trunc('day', now())
                                                  AND due_at < date_trunc('day', now()) + interval '1 day')::int AS today,
       COUNT(*) FILTER (WHERE status = 'pending' AND due_at >= date_trunc('day', now()) + interval '1 day')::int AS upcoming,
       COUNT(*)::int AS "all"
     FROM follow_ups
    WHERE organization_id = $1`,
    [req.user.organizationId]
  );
  res.json(rows[0] || { overdue: 0, today: 0, upcoming: 0, all: 0 });
});

// POST /follow-ups — manual "Add Follow-up" (Follow-ups page + Contact/Lead
// detail rowActions). { contact_id, lead_id?, due_at, priority?, disposition?, assigned_to?, notes? }
router.post('/follow-ups', canWrite, async (req, res) => {
  const { contact_id, lead_id, due_at, priority, disposition, assigned_to, notes } = req.body;
  if (!contact_id || !due_at) {
    return res.status(400).json({ error: 'contact_id and due_at are required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO follow_ups
       (organization_id, contact_id, lead_id, due_at, priority, disposition, assigned_to, notes, source, created_by)
     VALUES ($1,$2,$3,$4,COALESCE($5,'medium'),$6,$7,$8,'manual',$9)
     RETURNING *`,
    [req.user.organizationId, contact_id, lead_id || null, due_at, priority || null, disposition || null,
      assigned_to || null, notes || null, req.user.id]
  );
  logAudit(req, 'follow_up.create', { id: rows[0].id, contact_id });
  res.status(201).json(rows[0]);
});

// PUT /follow-ups/:id — edit fields, reschedule, mark completed/cancelled.
router.put('/follow-ups/:id', canWrite, async (req, res) => {
  const { due_at, status, priority, disposition, assigned_to, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE follow_ups SET
        due_at       = COALESCE($1, due_at),
        status       = COALESCE($2, status),
        priority     = COALESCE($3, priority),
        disposition  = COALESCE($4, disposition),
        assigned_to  = COALESCE($5, assigned_to),
        notes        = COALESCE($6, notes),
        completed_at = CASE WHEN $2 = 'completed' THEN now()
                             WHEN $2 IS NOT NULL THEN NULL
                             ELSE completed_at END,
        updated_at   = now()
      WHERE id = $7 AND organization_id = $8
      RETURNING *`,
    [due_at || null, status || null, priority || null, disposition || null,
      assigned_to || null, notes || null, req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Follow-up not found' });
  logAudit(req, 'follow_up.update', { id: req.params.id, changes: { due_at, status, priority, disposition, assigned_to } });
  res.json(rows[0]);
});

router.delete('/follow-ups/:id', canDelete, async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM follow_ups WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Follow-up not found' });
  logAudit(req, 'follow_up.delete', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
