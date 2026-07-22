const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

const canWrite = requirePermission('team:manage');
const canManageRoles = requirePermission('roles:manage');
const canReadAudit = requirePermission('audit:read');

app.get('/health', (_req, res) => res.json({ service: 'team', ok: true }));

// ---------- Users (password_hash is never returned) ----------
app.get('/users', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.availability, r.name AS role, u.created_at
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.organization_id=$1 ORDER BY u.created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/users', canWrite, async (req, res) => {
  const { name, email, password, role, availability } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (organization_id, role_id, name, email, password_hash, availability)
       VALUES ($1, (SELECT id FROM roles WHERE name=COALESCE($2,'agent')), $3, $4, $5, COALESCE($6,'offline'))
       RETURNING id, name, email, availability`,
      [req.user.organizationId, role, name, email, hash, availability]
    );
    logAudit(req, 'team.user.create', { id: rows[0].id, email });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    throw e;
  }
});

app.get('/users/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.availability, r.name AS role
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id=$1 AND u.organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/users/:id', canWrite, async (req, res) => {
  const { name, email, role, availability } = req.body;
  const { rows } = await pool.query(
    `UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email),
            role_id=COALESCE((SELECT id FROM roles WHERE name=$3), role_id),
            availability=COALESCE($4,availability)
      WHERE id=$5 AND organization_id=$6
      RETURNING id, name, email, availability`,
    [name, email, role, availability, req.params.id, req.user.organizationId]
  );
  logAudit(req, 'team.user.update', { id: req.params.id, changes: { name, email, role, availability } });
  res.json(rows[0] || {});
});

app.delete('/users/:id', canWrite, async (req, res) => {
  await pool.query(`DELETE FROM users WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  logAudit(req, 'team.user.delete', { id: req.params.id });
  res.json({ ok: true });
});

// ---------- Teams ----------
app.get('/teams', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM teams WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/teams', canWrite, async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO teams (organization_id, name) VALUES ($1,$2) RETURNING *`,
    [req.user.organizationId, req.body.name]
  );
  logAudit(req, 'team.team.create', { id: rows[0].id, name: rows[0].name });
  res.status(201).json(rows[0]);
});

app.get('/teams/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM teams WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/teams/:id', canWrite, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE teams SET name=COALESCE($1,name) WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.name, req.params.id, req.user.organizationId]
  );
  logAudit(req, 'team.team.update', { id: req.params.id, name: req.body.name });
  res.json(rows[0] || {});
});

app.delete('/teams/:id', canWrite, async (req, res) => {
  await pool.query(`DELETE FROM teams WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  logAudit(req, 'team.team.delete', { id: req.params.id });
  res.json({ ok: true });
});

// ---------- Audit logs ----------
app.get('/audit-logs', canReadAudit, async (req, res) => {
  const { action, userId, from, to, limit = 100, offset = 0 } = req.query;
  const { rows } = await pool.query(
    `SELECT a.id, a.action, a.meta, a.created_at, a.user_id, u.name AS user_name, u.email AS user_email
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.organization_id = $1
        AND ($2::text IS NULL OR a.action ILIKE '%' || $2 || '%')
        AND ($3::uuid IS NULL OR a.user_id = $3)
        AND ($4::timestamptz IS NULL OR a.created_at >= $4)
        AND ($5::timestamptz IS NULL OR a.created_at <= $5)
      ORDER BY a.created_at DESC
      LIMIT $6 OFFSET $7`,
    [req.user.organizationId, action || null, userId || null, from || null, to || null, Number(limit), Number(offset)]
  );
  res.json(rows);
});

// ---------- Roles & Permissions ----------
app.get('/permissions', async (_req, res) => {
  const { rows } = await pool.query(`SELECT id, code, description FROM permissions ORDER BY code`);
  res.json(rows);
});

app.get('/roles', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.name, r.description,
            COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
      GROUP BY r.id, r.name, r.description
      ORDER BY r.name`
  );
  res.json(rows);
});

app.put('/roles/:id/permissions', canManageRoles, async (req, res) => {
  const { codes } = req.body;
  if (!Array.isArray(codes)) return res.status(400).json({ error: 'codes must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [req.params.id]);
    if (codes.length) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code = ANY($2::text[])`,
        [req.params.id, codes]
      );
    }
    await client.query('COMMIT');
    logAudit(req, 'role.permissions.update', { roleId: req.params.id, codes });
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// ---------- Notifications ----------
app.get('/notifications', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE organization_id=$1 AND user_id=$2
      ORDER BY created_at DESC LIMIT 50`,
    [req.user.organizationId, req.user.userId]
  );
  res.json(rows);
});

app.get('/notifications/unread-count', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications
      WHERE organization_id=$1 AND user_id=$2 AND read = false`,
    [req.user.organizationId, req.user.userId]
  );
  res.json({ count: rows[0].count });
});

app.post('/notifications/:id/read', async (req, res) => {
  await pool.query(
    `UPDATE notifications SET read = true WHERE id=$1 AND organization_id=$2 AND user_id=$3`,
    [req.params.id, req.user.organizationId, req.user.userId]
  );
  res.json({ ok: true });
});

app.post('/notifications/read-all', async (req, res) => {
  await pool.query(
    `UPDATE notifications SET read = true WHERE organization_id=$1 AND user_id=$2 AND read = false`,
    [req.user.organizationId, req.user.userId]
  );
  res.json({ ok: true });
});

const PORT = process.env.TEAM_PORT || 4010;
app.listen(PORT, () => console.log(`team-service on :${PORT}`));
