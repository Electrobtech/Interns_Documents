require('dotenv').config();







const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { pool, authenticate, requireRole } = require('@lead/shared');
const webhookRoutes = require("./routes/webhook");
const authRoutes = require("./routes/auth");
const instagramRoutes = require("./routes/instagram");
const facebookRoutes = require("./routes/facebook");
const whatsappRoutes = require("./routes/whatsapp");
const credentialsRoutes = require("./routes/credentials");
const { startTokenRefreshScheduler } = require('./services/tokenRefreshJob');
const { startWebhookWorker } = require('./services/webhookWorker');
const app = express();


app.use((req, res, next) => {
  console.log("==================================");
  console.log(new Date().toISOString());
  console.log(req.method, req.originalUrl);
  console.log("Headers:", req.headers);
  next();
});
app.use(cors());
// Webhook needs its own raw-body handling before any JSON parsing.
app.use('/webhook', webhookRoutes);
app.use(express.json());
// /auth stays public at the router level — it protects its own sensitive
// sub-route (GET /connect-url) internally via `authenticate` in auth.js.
// The OAuth callback itself must remain public since Meta calls it directly.
app.use('/auth', authRoutes);
app.get('/health', (_req, res) => {
    res.json({
        service: 'integration',
        ok: true
    });
});

// Public root — lets a browser / tunnel smoke-test hit "/" and get 200 OK
// instead of the confusing 401 from the auth guard below. Must stay ABOVE
// app.use(authenticate).
app.get('/', (_req, res) => {
    res.json({
        service: 'integration',
        ok: true,
        webhook: '/webhook/meta'
    });
});

// Everything below requires a valid JWT — including /instagram and
// /facebook, so req.user.organizationId is available for proper
// multi-tenant scoping of publish/status routes.
app.use(authenticate);

app.use('/instagram', instagramRoutes);
app.use('/facebook', facebookRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/credentials', credentialsRoutes);

const asJson = (v) => (v == null || v === '' ? null : typeof v === 'string' ? v : JSON.stringify(v));

// ---------- Integrations ----------
app.get('/integrations', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM integrations WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/integrations', async (req, res) => {
  const { provider, status, credentials } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO integrations (organization_id, provider, status, credentials)
     VALUES ($1,$2,COALESCE($3,'disconnected'),COALESCE($4,'{}')) RETURNING *`,
    [req.user.organizationId, provider, status, asJson(credentials)]
  );
  res.status(201).json(rows[0]);
});

app.get('/integrations/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM integrations WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/integrations/:id', async (req, res) => {
  const { provider, status, credentials } = req.body;
  const { rows: current } = await pool.query(
    `SELECT locked_at FROM integrations WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  if (current.length === 0) return res.json({});
  if (current[0].locked_at != null && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'This integration is locked and can no longer be edited. Contact your account admin.',
    });
  }
  const { rows } = await pool.query(
    `UPDATE integrations SET provider=COALESCE($1,provider), status=COALESCE($2,status),
            credentials=COALESCE($3,credentials)
      WHERE id=$4 AND organization_id=$5 RETURNING *`,
    [provider, status, asJson(credentials), req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/integrations/:id', async (req, res) => {
  const { rows: current } = await pool.query(
    `SELECT locked_at FROM integrations WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  if (current.length > 0 && current[0].locked_at != null && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'This integration is locked and can no longer be removed. Contact your account admin.',
    });
  }
  await pool.query(`DELETE FROM integrations WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// ---------- API keys (secret shown once on creation) ----------
app.get('/api-keys', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, label, created_at FROM api_keys WHERE organization_id=$1 ORDER BY created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/api-keys', async (req, res) => {
  const { label } = req.body;
  const key = 'sk_' + crypto.randomBytes(24).toString('hex');
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const { rows } = await pool.query(
    `INSERT INTO api_keys (organization_id, key_hash, label)
     VALUES ($1,$2,$3) RETURNING id, label, created_at`,
    [req.user.organizationId, keyHash, label]
  );
  // Return the plaintext key exactly once — it is never stored or retrievable again.
  res.status(201).json({ ...rows[0], key });
});

app.delete('/api-keys/:id', async (req, res) => {
  await pool.query(`DELETE FROM api_keys WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// ---------- Webhooks ----------
app.get('/webhooks', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM webhooks WHERE organization_id=$1 ORDER BY id LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/webhooks', async (req, res) => {
  const { url, event, active } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO webhooks (organization_id, url, event, active)
     VALUES ($1,$2,$3,COALESCE($4,true)) RETURNING *`,
    [req.user.organizationId, url, event, active]
  );
  res.status(201).json(rows[0]);
});

app.get('/webhooks/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM webhooks WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/webhooks/:id', async (req, res) => {
  const { url, event, active } = req.body;
  const { rows } = await pool.query(
    `UPDATE webhooks SET url=COALESCE($1,url), event=COALESCE($2,event), active=COALESCE($3,active)
      WHERE id=$4 AND organization_id=$5 RETURNING *`,
    [url, event, active, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/webhooks/:id', async (req, res) => {
  await pool.query(`DELETE FROM webhooks WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// ---------- Channels (also used by the channel pages) ----------
app.get('/channels', async (req, res) => {
  const params = [req.user.organizationId];
  let sql = `SELECT * FROM channels WHERE organization_id=$1`;
  if (req.query.type) { params.push(req.query.type); sql += ` AND type=$${params.length}`; }
  sql += ` ORDER BY created_at DESC`;
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

app.post('/channels', async (req, res) => {
  const { type, display_name, status } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO channels (organization_id, type, display_name, status)
     VALUES ($1,$2,$3,COALESCE($4,'disconnected')) RETURNING *`,
    [req.user.organizationId, type, display_name, status]
  );
  res.status(201).json(rows[0]);
});

app.get('/channels/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM channels WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/channels/:id', async (req, res) => {
  const { type, display_name, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE channels SET type=COALESCE($1,type), display_name=COALESCE($2,display_name),
            status=COALESCE($3,status)
      WHERE id=$4 AND organization_id=$5 RETURNING *`,
    [type, display_name, status, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/channels/:id', async (req, res) => {
  await pool.query(`DELETE FROM channels WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

const PORT = process.env.INTEGRATION_PORT || 4009;
app.listen(PORT, () => {
  console.log(`integration-service on :${PORT}`);
  startTokenRefreshScheduler();
  startWebhookWorker();
});