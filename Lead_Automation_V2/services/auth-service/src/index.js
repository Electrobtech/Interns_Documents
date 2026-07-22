const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, sign, authenticate, logAuditRaw, permissionsForRoleId } = require('@lead/shared');
const companyController = require('./controllers/companyController');
const verificationController = require('./controllers/verificationController');
const gstController = require('./controllers/gstController');

const app = express();
app.use(cors());
app.use(express.json());

// Serves uploaded logos/certificates (see companyController.js) at
// /uploads/company/<file>. Public/unauthenticated, same as
// automation-service's /uploads/documents.
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.get('/health', (_req, res) => res.json({ service: 'auth', ok: true }));

// Company Registration (Tenant Onboarding) wizard — see controllers/ for
// details. Mounted before the existing routes below; none of those are
// modified.
app.use(companyController);
app.use(verificationController);
app.use(gstController);

// ---- Register (also creates an org on first signup) ----
app.post('/auth/register', async (req, res) => {
  const { name, password, orgName } = req.body;
  const email = req.body.email?.trim().toLowerCase();
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slug = (orgName || email.split('@')[1] || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const org = await client.query(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [orgName || 'My Organization', slug]
    );
    const role = await client.query(`SELECT id FROM roles WHERE name = 'admin'`);
    const hash = await bcrypt.hash(password, 10);
    const user = await client.query(
      `INSERT INTO users (organization_id, role_id, name, email, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [org.rows[0].id, role.rows[0].id, name || 'Admin', email, hash]
    );
    await client.query('COMMIT');
    const permissions = await permissionsForRoleId(role.rows[0].id);
    const token = sign({ userId: user.rows[0].id, organizationId: org.rows[0].id, role: 'admin', permissions });
    logAuditRaw(org.rows[0].id, user.rows[0].id, 'auth.register', { email });
    res.status(201).json({ token });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// ---- Login ----
app.post('/auth/login', async (req, res) => {
  const { password } = req.body;
  const email = req.body.email?.trim().toLowerCase();
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  const { rows } = await pool.query(
    `SELECT u.id, u.organization_id, u.password_hash, u.role_id, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1 LIMIT 1`,
    [email]
  );
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) {
    logAuditRaw(rows[0].organization_id, rows[0].id, 'auth.login_failed', { email });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const permissions = await permissionsForRoleId(rows[0].role_id);
  const token = sign({ userId: rows[0].id, organizationId: rows[0].organization_id, role: rows[0].role, permissions });
  logAuditRaw(rows[0].organization_id, rows[0].id, 'auth.login', { email });
  res.json({ token });
});

// ---- Profile (protected) ----
app.get('/auth/profile', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, r.name AS role, o.name AS organization
       FROM users u JOIN roles r ON r.id = u.role_id
       JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = $1`,
    [req.user.userId]
  );
  res.json(rows[0] || {});
});

app.post('/auth/logout', authenticate, (req, res) => {
  logAuditRaw(req.user.organizationId, req.user.userId, 'auth.logout', {});
  res.json({ ok: true });
});

const PORT = process.env.AUTH_PORT || 4001;
app.listen(PORT, () => console.log(`auth-service on :${PORT}`));