const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, authenticate, requireRole } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

const canWrite = requireRole('admin', 'manager');

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
  res.json(rows[0] || {});
});

app.delete('/users/:id', canWrite, async (req, res) => {
  await pool.query(`DELETE FROM users WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
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
  res.json(rows[0] || {});
});

app.delete('/teams/:id', canWrite, async (req, res) => {
  await pool.query(`DELETE FROM teams WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

const PORT = process.env.TEAM_PORT || 4010;
app.listen(PORT, () => console.log(`team-service on :${PORT}`));
