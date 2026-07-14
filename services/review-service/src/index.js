const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'review', ok: true }));

// ---------- Reviews ----------
app.get('/reviews', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM reviews WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/reviews', async (req, res) => {
  const { source, author, rating, body, reply } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO reviews (organization_id, source, author, rating, body, reply)
     VALUES ($1,COALESCE($2,'google'),$3,$4,$5,$6) RETURNING *`,
    [req.user.organizationId, source, author, rating || null, body, reply]
  );
  res.status(201).json(rows[0]);
});

app.get('/reviews/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM reviews WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/reviews/:id', async (req, res) => {
  const { source, author, rating, body, reply } = req.body;
  const { rows } = await pool.query(
    `UPDATE reviews SET source=COALESCE($1,source), author=COALESCE($2,author),
            rating=COALESCE($3,rating), body=COALESCE($4,body), reply=COALESCE($5,reply)
      WHERE id=$6 AND organization_id=$7 RETURNING *`,
    [source, author, rating, body, reply, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/reviews/:id', async (req, res) => {
  await pool.query(`DELETE FROM reviews WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// ---------- Social comments ----------
app.get('/social', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM social_comments WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/social', async (req, res) => {
  const { source, author, body, reply } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO social_comments (organization_id, source, author, body, reply)
     VALUES ($1,COALESCE($2,'facebook'),$3,$4,$5) RETURNING *`,
    [req.user.organizationId, source, author, body, reply]
  );
  res.status(201).json(rows[0]);
});

app.get('/social/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM social_comments WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/social/:id', async (req, res) => {
  const { source, author, body, reply } = req.body;
  const { rows } = await pool.query(
    `UPDATE social_comments SET source=COALESCE($1,source), author=COALESCE($2,author),
            body=COALESCE($3,body), reply=COALESCE($4,reply)
      WHERE id=$5 AND organization_id=$6 RETURNING *`,
    [source, author, body, reply, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/social/:id', async (req, res) => {
  await pool.query(`DELETE FROM social_comments WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

const PORT = process.env.REVIEW_PORT || 4007;
app.listen(PORT, () => console.log(`review-service on :${PORT}`));
