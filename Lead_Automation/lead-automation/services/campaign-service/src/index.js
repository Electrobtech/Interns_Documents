const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

// jsonb columns accept either a JSON string (from a textarea) or a JS object.
const asJson = (v) => (v == null || v === '' ? null : typeof v === 'string' ? v : JSON.stringify(v));

app.get('/health', (_req, res) => res.json({ service: 'campaign', ok: true }));

app.get('/campaigns', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM campaigns WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/campaigns', async (req, res) => {
  const { name, type, channel_type, message_body, cta, scheduled_at, status } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO campaigns (organization_id, name, type, channel_type, message_body, cta, scheduled_at, status)
     VALUES ($1,$2,COALESCE($3,'broadcast'),$4,$5,$6,$7,COALESCE($8,'draft')) RETURNING *`,
    [req.user.organizationId, name, type, channel_type, message_body, asJson(cta), scheduled_at || null, status]
  );
  res.status(201).json(rows[0]);
});

app.get('/campaigns/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/campaigns/:id', async (req, res) => {
  const { name, type, channel_type, message_body, cta, scheduled_at, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE campaigns SET name=COALESCE($1,name), type=COALESCE($2,type),
            channel_type=COALESCE($3,channel_type), message_body=COALESCE($4,message_body),
            cta=COALESCE($5,cta), scheduled_at=COALESCE($6,scheduled_at), status=COALESCE($7,status)
      WHERE id=$8 AND organization_id=$9 RETURNING *`,
    [name, type, channel_type, message_body, asJson(cta), scheduled_at || null, status,
     req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/campaigns/:id', async (req, res) => {
  await pool.query(`DELETE FROM campaigns WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// Mark a campaign as sent and log a delivery event.
app.post('/campaigns/:id/send', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE campaigns SET status='sent' WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [req.params.id, req.user.organizationId]
  );
  if (rows.length) {
    await pool.query(`INSERT INTO campaign_logs (campaign_id, event) VALUES ($1,'delivered')`,
      [req.params.id]);
  }
  res.json(rows[0] || {});
});

const PORT = process.env.CAMPAIGN_PORT || 4004;
app.listen(PORT, () => console.log(`campaign-service on :${PORT}`));
