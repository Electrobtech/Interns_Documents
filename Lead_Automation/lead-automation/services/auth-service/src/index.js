const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, sign, authenticate, withSystemAccess } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ service: 'auth', ok: true }));

// ---- Register (also creates an org on first signup) ----
// Runs under withSystemAccess: at this point there's no logged-in tenant
// yet — we're creating one — so this is one of only two places in the
// codebase allowed to bypass row-level security (see infra/db/rls.sql).
app.post('/auth/register', async (req, res) => {
  const { name, email, password, orgName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });

  try {
    const result = await withSystemAccess(async () => {
      await pool.query('BEGIN');
      try {
        const slug = (orgName || email.split('@')[1] || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const org = await pool.query(
          `INSERT INTO organizations (name, slug) VALUES ($1, $2)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [orgName || 'My Organization', slug]
        );
        const role = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
        const hash = await bcrypt.hash(password, 10);
        const user = await pool.query(
          `INSERT INTO users (organization_id, role_id, name, email, password_hash)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [org.rows[0].id, role.rows[0].id, name || 'Admin', email, hash]
        );
        await pool.query('COMMIT');
        return { organizationId: org.rows[0].id, userId: user.rows[0].id };
      } catch (e) {
        await pool.query('ROLLBACK');
        throw e;
      }
    });

    const token = sign({ userId: result.userId, organizationId: result.organizationId, role: 'admin' });
    res.status(201).json({ token });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ---- Login ----
// Also under withSystemAccess: we don't know which org this email belongs
// to until we've looked it up.
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await withSystemAccess(() => pool.query(
    `SELECT u.id, u.organization_id, u.password_hash, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1 LIMIT 1`,
    [email]
  ));
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = sign({ userId: rows[0].id, organizationId: rows[0].organization_id, role: rows[0].role });
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

app.post('/auth/logout', authenticate, (_req, res) => res.json({ ok: true }));

const PORT = process.env.AUTH_PORT || 4001;
app.listen(PORT, () => console.log(`auth-service on :${PORT}`));
