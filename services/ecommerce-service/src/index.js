const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

const asJson = (v) => (v == null || v === '' ? null : typeof v === 'string' ? v : JSON.stringify(v));

app.get('/health', (_req, res) => res.json({ service: 'ecommerce', ok: true }));

// ---------- Orders ----------
app.get('/orders', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.*, c.name AS contact_name
       FROM ecommerce_orders o
       LEFT JOIN contacts c ON c.id = o.contact_id
      WHERE o.organization_id=$1 ORDER BY o.created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/orders', async (req, res) => {
  const { contact_id, amount, payment_type, status } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO ecommerce_orders (organization_id, contact_id, amount, payment_type, status)
     VALUES ($1,$2,$3,$4,COALESCE($5,'pending')) RETURNING *`,
    [req.user.organizationId, contact_id || null, amount || 0, payment_type, status]
  );
  res.status(201).json(rows[0]);
});

app.get('/orders/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM ecommerce_orders WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/orders/:id', async (req, res) => {
  const { contact_id, amount, payment_type, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE ecommerce_orders SET contact_id=COALESCE($1,contact_id), amount=COALESCE($2,amount),
            payment_type=COALESCE($3,payment_type), status=COALESCE($4,status)
      WHERE id=$5 AND organization_id=$6 RETURNING *`,
    [contact_id || null, amount, payment_type, status, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/orders/:id', async (req, res) => {
  await pool.query(`DELETE FROM ecommerce_orders WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// ---------- Carts ----------
app.get('/carts', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ca.*, c.name AS contact_name
       FROM carts ca
       LEFT JOIN contacts c ON c.id = ca.contact_id
      WHERE ca.organization_id=$1 ORDER BY ca.created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/carts', async (req, res) => {
  const { contact_id, value, recovered } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO carts (organization_id, contact_id, value, recovered)
     VALUES ($1,$2,$3,COALESCE($4,false)) RETURNING *`,
    [req.user.organizationId, contact_id || null, value || 0, recovered]
  );
  res.status(201).json(rows[0]);
});

app.get('/carts/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM carts WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/carts/:id', async (req, res) => {
  const { contact_id, value, recovered } = req.body;
  const { rows } = await pool.query(
    `UPDATE carts SET contact_id=COALESCE($1,contact_id), value=COALESCE($2,value),
            recovered=COALESCE($3,recovered)
      WHERE id=$4 AND organization_id=$5 RETURNING *`,
    [contact_id || null, value, recovered, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/carts/:id', async (req, res) => {
  await pool.query(`DELETE FROM carts WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// ---------- Recovery flows ----------
app.get('/recovery-flows', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM recovery_flows WHERE organization_id=$1 ORDER BY name LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/recovery-flows', async (req, res) => {
  const { name, steps, active } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO recovery_flows (organization_id, name, steps, active)
     VALUES ($1,$2,COALESCE($3,'[]'),COALESCE($4,true)) RETURNING *`,
    [req.user.organizationId, name, asJson(steps), active]
  );
  res.status(201).json(rows[0]);
});

app.get('/recovery-flows/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM recovery_flows WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/recovery-flows/:id', async (req, res) => {
  const { name, steps, active } = req.body;
  const { rows } = await pool.query(
    `UPDATE recovery_flows SET name=COALESCE($1,name), steps=COALESCE($2,steps), active=COALESCE($3,active)
      WHERE id=$4 AND organization_id=$5 RETURNING *`,
    [name, asJson(steps), active, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/recovery-flows/:id', async (req, res) => {
  await pool.query(`DELETE FROM recovery_flows WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

const PORT = process.env.ECOMMERCE_PORT || 4006;
app.listen(PORT, () => console.log(`ecommerce-service on :${PORT}`));
