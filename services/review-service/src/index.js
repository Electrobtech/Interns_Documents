const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'review', ok: true }));

const INTEGRATION_SERVICE_URL = process.env.INTEGRATION_SERVICE_URL || 'http://localhost:4009';

/**
 * Actually posts a reply to the underlying Facebook/Instagram comment via
 * integration-service, using the caller's own JWT so its multi-tenant
 * scoping still applies. Returns silently (no-op) for sources we don't
 * have a live connector for (e.g. linkedin) or rows with no captured
 * external_comment_id (e.g. manually-entered comments).
 */
async function deliverCommentReply(authHeader, row, message) {
  if (!row.external_comment_id) return { delivered: false, reason: 'No external comment id on file for this row.' };

  const path = row.source === 'instagram' ? '/instagram/reply-comment' : '/facebook/reply-comment';
  const resp = await fetch(`${INTEGRATION_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({ commentId: row.external_comment_id, message }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || data.message || 'Failed to post reply.');
  return { delivered: true, raw: data };
}

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

  const { rows: existingRows } = await pool.query(
    `SELECT * FROM social_comments WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  if (!existingRows.length) return res.json({});
  const existing = existingRows[0];

  // If `reply` is being set/changed, actually post it to Meta first — no
  // point saving a reply in our own DB that was never really sent.
  let deliveryNote = null;
  if (reply && reply !== existing.reply) {
    try {
      const result = await deliverCommentReply(req.headers.authorization, existing, reply);
      if (!result.delivered) deliveryNote = result.reason;
    } catch (err) {
      console.error('Comment reply delivery failed:', err.message);
      return res.status(502).json({ error: `Could not post reply: ${err.message}` });
    }
  }

  const { rows } = await pool.query(
    `UPDATE social_comments SET source=COALESCE($1,source), author=COALESCE($2,author),
            body=COALESCE($3,body), reply=COALESCE($4,reply)
      WHERE id=$5 AND organization_id=$6 RETURNING *`,
    [source, author, body, reply, req.params.id, req.user.organizationId]
  );
  res.json({ ...rows[0], _deliveryNote: deliveryNote });
});

// Explicit reply action (used by the inbox-style "Reply" UI) — same
// delivery path as PUT /social/:id with a `reply`, exposed as its own
// endpoint for clients that don't want to resend the whole row.
app.post('/social/:id/reply', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required.' });

  const { rows: existingRows } = await pool.query(
    `SELECT * FROM social_comments WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  if (!existingRows.length) return res.status(404).json({ error: 'Not found' });

  try {
    await deliverCommentReply(req.headers.authorization, existingRows[0], message);
  } catch (err) {
    console.error('Comment reply delivery failed:', err.message);
    return res.status(502).json({ error: `Could not post reply: ${err.message}` });
  }

  const { rows } = await pool.query(
    `UPDATE social_comments SET reply=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [message, req.params.id, req.user.organizationId]
  );
  res.json(rows[0]);
});

app.delete('/social/:id', async (req, res) => {
  await pool.query(`DELETE FROM social_comments WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

const PORT = process.env.REVIEW_PORT || 4007;
app.listen(PORT, () => console.log(`review-service on :${PORT}`));
