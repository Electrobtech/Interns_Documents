import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool, authenticate, requirePermission, logAudit } from '@lead/shared';

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

const canWrite = requirePermission('inbox:write');

const VALID_STATUSES = [
  'new', 'open', 'pending', 'resolved', 'snoozed', 'handoff', 'archived', 'spam', 'closed', 'campaign', 'missed',
];

app.get('/health', (_req, res) => res.json({ ok: true, service: 'inbox-service' }));

app.get('/conversations', async (req, res) => {
  const { status, channel, assigned_to, q: search, limit = 50, offset = 0 } = req.query;

  const { rows } = await pool.query(
    `SELECT c.*,
       ct.name as contact_name,
       ct.email as contact_email,
       ct.phone as contact_phone,
       ct.tags as contact_tags,
       (SELECT body FROM messages WHERE conversation_id = c.id
        ORDER BY created_at DESC LIMIT 1) as last_message_preview,
       (SELECT COUNT(*) FROM messages
        WHERE conversation_id = c.id AND direction = 'inbound')::int as inbound_count
     FROM conversations c
     JOIN contacts ct ON ct.id = c.contact_id
     WHERE c.organization_id = $1
       AND ($2::text IS NULL OR c.status = $2)
       AND ($3::text IS NULL OR c.channel_type = $3)
       AND ($4::uuid IS NULL OR c.assigned_to = $4)
       AND ($5::text IS NULL OR ct.name ILIKE '%' || $5 || '%')
     ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
     LIMIT $6 OFFSET $7`,
    [req.user.organizationId, status || null, channel || null, assigned_to || null, search || null, Number(limit), Number(offset)]
  );

  res.json(rows);
});

app.get('/conversations/:id', async (req, res) => {
  const convRes = await pool.query(
    `SELECT c.*, ct.name as contact_name, ct.email as contact_email,
            ct.phone as contact_phone, ct.tags as contact_tags
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.id = $1 AND c.organization_id = $2`,
    [req.params.id, req.user.organizationId]
  );

  if (!convRes.rows.length) return res.status(404).json({ error: 'not found' });

  const msgRes = await pool.query(
    `SELECT * FROM messages WHERE conversation_id = $1 AND organization_id = $2 ORDER BY created_at ASC`,
    [req.params.id, req.user.organizationId]
  );

  res.json({ conversation: convRes.rows[0], messages: msgRes.rows });
});

app.post('/conversations/:id/reply', canWrite, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  const { rows } = await pool.query(
    `SELECT id FROM conversations WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });

  await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender, message_type, created_at)
     VALUES ($1, $2, 'outbound', $3, $4, 'text', NOW())`,
    [req.user.organizationId, req.params.id, content, 'Agent']
  );

  await pool.query(
    `UPDATE conversations SET status = 'open', last_message_at = NOW() WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.organizationId]
  );

  logAudit(req, 'inbox.reply', { conversationId: req.params.id });
  res.json({ sent: true });
});

app.post('/conversations/:id/assign', canWrite, async (req, res) => {
  const { assigned_to } = req.body;
  const { rows } = await pool.query(
    `UPDATE conversations SET assigned_to = $1 WHERE id = $2 AND organization_id = $3 RETURNING *`,
    [assigned_to || null, req.params.id, req.user.organizationId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  logAudit(req, 'inbox.assign', { conversationId: req.params.id, assignedTo: assigned_to });
  res.json({ assigned_to: rows[0].assigned_to });
});

app.post('/conversations/:id/status', canWrite, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const { rows } = await pool.query(
    `UPDATE conversations SET status = $1 WHERE id = $2 AND organization_id = $3 RETURNING *`,
    [status, req.params.id, req.user.organizationId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  logAudit(req, 'inbox.status_change', { conversationId: req.params.id, status });
  res.json({ status: rows[0].status });
});

// Notes have no dedicated column on conversations — stored as a message
// with message_type='note' (messages.metadata is real JSONB, unlike
// conversations, which has no metadata column in this schema).
app.post('/conversations/:id/note', canWrite, async (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'note required' });

  const { rows } = await pool.query(
    `SELECT id FROM conversations WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });

  await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender, message_type, created_at)
     VALUES ($1, $2, 'outbound', $3, $4, 'note', NOW())`,
    [req.user.organizationId, req.params.id, note, 'Agent']
  );

  logAudit(req, 'inbox.note', { conversationId: req.params.id });
  res.json({ note });
});

const PORT = process.env.PORT || 4006;
app.listen(PORT, () => console.log(`Inbox service on ${PORT}`));
