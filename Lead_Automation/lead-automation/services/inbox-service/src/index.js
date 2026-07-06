const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate); // every inbox route requires a valid token

app.get('/health', (_req, res) => res.json({ service: 'inbox', ok: true }));

// List conversations for the caller's org, with optional filters.
app.get('/conversations', async (req, res) => {
  const org = req.user.organizationId;
  const { status, channel } = req.query;
  const params = [org];
  let sql = `SELECT c.id, c.channel_type, c.status, c.last_message_at,
                    ct.name AS contact_name
               FROM conversations c
               LEFT JOIN contacts ct ON ct.id = c.contact_id
              WHERE c.organization_id = $1`;
  if (status)  { params.push(status);  sql += ` AND c.status = $${params.length}`; }
  if (channel) { params.push(channel); sql += ` AND c.channel_type = $${params.length}`; }
  sql += ` ORDER BY c.last_message_at DESC LIMIT 100`;
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

app.get('/conversations/:id', async (req, res) => {
  const org = req.user.organizationId;
  const conv = await pool.query(
    `SELECT * FROM conversations WHERE id=$1 AND organization_id=$2`,
    [req.params.id, org]
  );
  if (!conv.rows.length) return res.status(404).json({ error: 'Not found' });
  const msgs = await pool.query(
    `SELECT id, direction, body, sender, created_at FROM messages
      WHERE conversation_id=$1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ ...conv.rows[0], messages: msgs.rows });
});

// Post a reply (outbound message).
app.post('/conversations/:id/reply', async (req, res) => {
  const org = req.user.organizationId;
  const { body } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender)
     VALUES ($1,$2,'outbound',$3,$4) RETURNING *`,
    [org, req.params.id, body, req.user.userId]
  );
  await pool.query(`UPDATE conversations SET last_message_at=now() WHERE id=$1`, [req.params.id]);
  res.status(201).json(rows[0]);
});

app.put('/conversations/:id/status', async (req, res) => {
  const org = req.user.organizationId;
  const { rows } = await pool.query(
    `UPDATE conversations SET status=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.status, req.params.id, org]
  );
  res.json(rows[0] || {});
});

app.put('/conversations/:id/assign', async (req, res) => {
  const org = req.user.organizationId;
  const { rows } = await pool.query(
    `UPDATE conversations SET assigned_to=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.userId, req.params.id, org]
  );
  res.json(rows[0] || {});
});

const PORT = process.env.INBOX_PORT || 4002;
app.listen(PORT, () => console.log(`inbox-service on :${PORT}`));
