const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'contact', ok: true }));

app.get('/contacts', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM contacts WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/contacts', async (req, res) => {
  const { name, email, phone, source, tags } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO contacts (organization_id, name, email, phone, source, tags)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.organizationId, name, email, phone, source, tags || []]
  );
  res.status(201).json(rows[0]);
});

app.get('/contacts/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM contacts WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/contacts/:id', async (req, res) => {
  const { name, email, phone, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE contacts SET name=COALESCE($1,name), email=COALESCE($2,email),
            phone=COALESCE($3,phone), notes=COALESCE($4,notes)
      WHERE id=$5 AND organization_id=$6 RETURNING *`,
    [name, email, phone, notes, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/contacts/:id', async (req, res) => {
  await pool.query(`DELETE FROM contacts WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// Leads
app.get('/leads', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.*, c.name FROM leads l JOIN contacts c ON c.id=l.contact_id
      WHERE l.organization_id=$1 ORDER BY l.created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.put('/leads/:id/stage', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE leads SET stage=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.stage, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

const PORT = process.env.CONTACT_PORT || 4003;
app.listen(PORT, () => console.log(`contact-service on :${PORT}`));
