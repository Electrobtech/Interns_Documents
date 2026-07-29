const express = require('express');
const cors = require('cors');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');
const { attachRealtime } = require('./realtime');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate); // every inbox route requires a valid token

const canWrite = requirePermission('inbox:write');

const VALID_STATUSES = [
  'new', 'open', 'pending', 'resolved', 'snoozed', 'handoff', 'archived', 'spam', 'closed', 'campaign', 'missed',
];

app.get('/health', (_req, res) => res.json({ service: 'inbox', ok: true }));

// List conversations for the caller's org, with optional filters.
app.get('/conversations', async (req, res) => {
  const { status, channel, assigned_to, q: search, limit = 100, offset = 0 } = req.query;

  const { rows } = await pool.query(
    `SELECT c.id, c.channel_type, c.status, c.handled_by, c.assigned_to, c.last_message_at,
            ct.name AS contact_name, ct.email AS contact_email, ct.phone AS contact_phone, ct.tags AS contact_tags,
            (SELECT body FROM messages m WHERE m.conversation_id = c.id
              ORDER BY created_at DESC LIMIT 1) AS last_message_preview,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.direction = 'inbound')::int AS inbound_count
       FROM conversations c
       LEFT JOIN contacts ct ON ct.id = c.contact_id
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
  const org = req.user.organizationId;
  // Joined to contacts for contact_name/contact_id — previously this was a
  // bare `SELECT *` on conversations alone, so the Unified Inbox's
  // conversation header always fell back to displaying the raw internal
  // contact UUID (conv.contact_id) instead of the contact's actual name,
  // since contact_name was never present on this response at all. The list
  // endpoint above already joined contacts correctly; this brings the
  // single-conversation view in line with it.
  const conv = await pool.query(
    `SELECT c.*, ct.name AS contact_name, ct.external_id AS contact_external_id
       FROM conversations c
       LEFT JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.id=$1 AND c.organization_id=$2`,
    [req.params.id, org]
  );
  if (!conv.rows.length) return res.status(404).json({ error: 'Not found' });
  // message_type/metadata added alongside the original columns so the
  // Unified Inbox UI can render a bot message's buttons/list options and
  // let a CRM user click one to simulate the customer's reply (see
  // frontend/src/app/(app)/inbox/[id]/page.jsx) — metadata is exactly the
  // buildSendTemplate()-shaped payload automation-service's messageRepository
  // already stores for every outbound send, untouched here.
  const msgs = await pool.query(
    `SELECT id, direction, body, sender, message_type, metadata, created_at FROM messages
      WHERE conversation_id=$1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ ...conv.rows[0], messages: msgs.rows });
});

// Post a reply (outbound message).
app.post('/conversations/:id/reply', canWrite, async (req, res) => {
  const org = req.user.organizationId;
  const { body } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender)
     VALUES ($1,$2,'outbound',$3,$4) RETURNING *`,
    [org, req.params.id, body, req.user.userId]
  );
  await pool.query(`UPDATE conversations SET last_message_at=now() WHERE id=$1`, [req.params.id]);
  logAudit(req, 'inbox.reply', { conversationId: req.params.id });
  res.status(201).json(rows[0]);
});

app.put('/conversations/:id/status', canWrite, async (req, res) => {
  const org = req.user.organizationId;
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const { rows } = await pool.query(
    `UPDATE conversations SET status=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [status, req.params.id, org]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  logAudit(req, 'inbox.status_change', { conversationId: req.params.id, status });
  res.json(rows[0]);
});

// Switches who owns replying on this conversation: 'bot' hands it back to
// the automation flow (the next inbound webhook will resolve/start a
// playbook normally — see automation-service's webhookController, which
// checks this same flag before invoking the engine), 'human' silences the
// bot immediately, including mid-flow, not just after a Handoff node.
app.put('/conversations/:id/handled-by', canWrite, async (req, res) => {
  const org = req.user.organizationId;
  const { handled_by } = req.body;
  if (!['bot', 'human'].includes(handled_by)) {
    return res.status(400).json({ error: `handled_by must be "bot" or "human"` });
  }
  const { rows } = await pool.query(
    `UPDATE conversations
        SET handled_by = $1,
            status = CASE WHEN $1 = 'human' AND status = 'open' THEN 'pending' ELSE status END
      WHERE id = $2 AND organization_id = $3
      RETURNING *`,
    [handled_by, req.params.id, org]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  logAudit(req, 'inbox.handled_by_change', { conversationId: req.params.id, handled_by });
  res.json(rows[0]);
});

app.put('/conversations/:id/assign', canWrite, async (req, res) => {
  const org = req.user.organizationId;
  const { rows } = await pool.query(
    `UPDATE conversations SET assigned_to=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.userId, req.params.id, org]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  logAudit(req, 'inbox.assign', { conversationId: req.params.id, assignedTo: req.body.userId });
  res.json(rows[0]);
});

// Notes have no dedicated column on conversations — stored as a message
// with message_type='note' (messages.metadata is real JSONB, unlike
// conversations, which has no metadata column in this schema).
app.post('/conversations/:id/note', canWrite, async (req, res) => {
  const org = req.user.organizationId;
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'note required' });

  const { rows } = await pool.query(
    `SELECT id FROM conversations WHERE id = $1 AND organization_id = $2`,
    [req.params.id, org]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });

  await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender, message_type, created_at)
     VALUES ($1, $2, 'outbound', $3, $4, 'note', NOW())`,
    [org, req.params.id, note, req.user.userId]
  );
  logAudit(req, 'inbox.note', { conversationId: req.params.id });
  res.json({ note });
});

// Resets a conversation to a clean slate — wipes the message transcript,
// reopens it, hands it back to the bot, and drops any in-progress
// automation-service flow state for this contact/channel (see
// conversation_sessions in automation-service's conversationSessionRepository)
// so the next inbound message starts the playbook over from its entry node
// instead of resuming mid-flow. Meant for re-running a demo from scratch.
// Both services share this Postgres instance (see docker-compose.yml), so
// this is a plain cross-table delete rather than a call into automation-service.
app.post('/conversations/:id/reset', canWrite, async (req, res) => {
  const org = req.user.organizationId;
  const conv = await pool.query(
    `SELECT c.*, ct.source AS contact_source, ct.external_id AS contact_external_id
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.id = $1 AND c.organization_id = $2`,
    [req.params.id, org]
  );
  if (!conv.rows[0]) return res.status(404).json({ error: 'Not found' });
  const { contact_source: channel, contact_external_id: externalId } = conv.rows[0];

  await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [req.params.id]);

  const { rows } = await pool.query(
    `UPDATE conversations
        SET status = 'open', handled_by = 'bot', last_message_at = now()
      WHERE id = $1 AND organization_id = $2
      RETURNING *`,
    [req.params.id, org]
  );

  // Best-effort: a demo reset should still succeed even if this contact
  // never had a bot session, or the table's momentarily unreachable.
  if (channel && externalId) {
    try {
      await pool.query(
        `DELETE FROM conversation_sessions WHERE organization_id = $1 AND channel = $2 AND contact_external_id = $3`,
        [org, channel, externalId]
      );
    } catch (err) {
      console.error('[inbox-service] failed to clear automation session on reset (non-fatal):', err.message);
    }
  }

  logAudit(req, 'inbox.reset', { conversationId: req.params.id });
  res.json(rows[0]);
});

const PORT = process.env.INBOX_PORT || 4002;
const server = app.listen(PORT, () => console.log(`inbox-service on :${PORT}`));
attachRealtime(server);
