const express = require('express');
const cors = require('cors');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');
const { attachRealtime } = require('./realtime');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate); // every inbox route requires a valid token

const canWrite = requirePermission('inbox:write');

// Used by POST /conversations/:id/reply to forward email replies to the
// service that actually talks to the Gmail API — see that route for why.
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://email-service:4013';

const VALID_STATUSES = [
  'new', 'open', 'pending', 'resolved', 'snoozed', 'handoff', 'archived', 'spam', 'closed', 'campaign', 'missed',
];

app.get('/health', (_req, res) => res.json({ service: 'inbox', ok: true }));

// List conversations for the caller's org, with optional filters.
app.get('/conversations', async (req, res) => {
  const { status, channel, assigned_to, q: search, limit = 100, offset = 0 } = req.query;

  // lead_stage/assigned_to_name are joined in the same shape as the
  // single-conversation endpoint below (l LATERAL join + users join) so the
  // conversation list can render a "Lead" tag and an "Assigned to <name>"
  // badge (QuickReply-style chat list) without a second round trip per row.
  const { rows } = await pool.query(
    `SELECT c.id, c.channel_type, c.status, c.handled_by, c.assigned_to, c.last_message_at,
            ct.name AS contact_name, ct.email AS contact_email, ct.phone AS contact_phone, ct.tags AS contact_tags,
            u.name AS assigned_to_name,
            l.stage AS lead_stage,
            (SELECT body FROM messages m WHERE m.conversation_id = c.id
              ORDER BY created_at DESC LIMIT 1) AS last_message_preview,
            -- FIX: this used to count every inbound message this
            -- conversation has EVER received, so the purple badge in the
            -- Unified Inbox list never cleared even after opening the
            -- thread (which only bumps last_read_at). Scoped to
            -- last_read_at, matching /conversations/unread-summary and
            -- the GET /conversations/:id read-receipt logic below.
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id
              AND m.direction = 'inbound' AND m.created_at > c.last_read_at)::int AS inbound_count
       FROM conversations c
       LEFT JOIN contacts ct ON ct.id = c.contact_id
       LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN LATERAL (
         SELECT stage FROM leads
          WHERE contact_id = c.contact_id AND organization_id = c.organization_id
          ORDER BY created_at DESC LIMIT 1
       ) l ON TRUE
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

// Per-channel unread counts, for the sidebar's WhatsApp-style badges — a
// message counts as unread when it's inbound and newer than the
// conversation's last_read_at (bumped to now() below whenever the thread
// is opened). Returned as both a byChannel map (keyed the same as
// Sidebar.jsx's CHANNELS[].href, e.g. 'whatsapp', 'instagram') and a total,
// so the frontend doesn't have to sum it itself.
app.get('/conversations/unread-summary', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.channel_type, COUNT(m.id)::int AS unread_count
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
      WHERE c.organization_id = $1
        AND m.direction = 'inbound'
        AND m.created_at > c.last_read_at
      GROUP BY c.channel_type`,
    [req.user.organizationId]
  );
  const byChannel = {};
  let total = 0;
  for (const row of rows) {
    byChannel[row.channel_type] = row.unread_count;
    total += row.unread_count;
  }
  res.json({ byChannel, total });
});

// True per-channel + total conversation counts (uncapped, unlike the
// /conversations list above), for the Unified Inbox's filter-chip badges
// and header total. Registered BEFORE /conversations/:id — Express
// matches routes in declaration order, and without this route a request
// for /conversations/channel-counts falls through to /conversations/:id
// with id="channel-counts", which Postgres then rejects as an invalid
// UUID (22P02) with no try/catch around it, crashing the whole process.
app.get('/conversations/channel-counts', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT channel_type, COUNT(*)::int AS count
       FROM conversations
      WHERE organization_id = $1
      GROUP BY channel_type`,
    [req.user.organizationId]
  );
  const byChannel = {};
  let total = 0;
  for (const row of rows) {
    byChannel[row.channel_type] = row.count;
    total += row.count;
  }
  res.json({ byChannel, total });
});

app.get('/conversations/:id', async (req, res) => {
  const org = req.user.organizationId;
  // Defense in depth: even with channel-counts registered above, any other
  // non-UUID path segment (typo, stale bookmark, bad client code) would
  // otherwise hit the same unhandled 22P02 crash this route just caused.
  // Fail with a normal 400 instead of taking the whole service down.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid conversation id' });
  }
  // Joined to contacts for contact_name/contact_id — previously this was a
  // bare `SELECT *` on conversations alone, so the Unified Inbox's
  // conversation header always fell back to displaying the raw internal
  // contact UUID (conv.contact_id) instead of the contact's actual name,
  // since contact_name was never present on this response at all. The list
  // endpoint above already joined contacts correctly; this brings the
  // single-conversation view in line with it.
  // Contact and lead columns come along so the Unified Inbox's context rail
  // can render who this is without a second round trip. Only real columns —
  // there is no company/deal-value field on contacts, so the UI shows what
  // exists rather than inventing it. The lead join takes the most recent lead
  // row for the contact (a contact can be re-qualified over time).
  const conv = await pool.query(
    `SELECT c.*,
            ct.name AS contact_name, ct.external_id AS contact_external_id,
            ct.email AS contact_email, ct.phone AS contact_phone,
            ct.source AS contact_source, ct.tags AS contact_tags,
            ct.notes AS contact_notes, ct.created_at AS contact_created_at,
            l.score AS lead_score, l.stage AS lead_stage, l.priority AS lead_priority,
            u.name AS assigned_to_name, u.email AS assigned_to_email
       FROM conversations c
       LEFT JOIN contacts ct ON ct.id = c.contact_id
       LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN LATERAL (
         SELECT score, stage, priority FROM leads
          WHERE contact_id = c.contact_id AND organization_id = c.organization_id
          ORDER BY created_at DESC LIMIT 1
       ) l ON TRUE
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

  // Opening the thread clears its unread badge, the same way opening a
  // chat in WhatsApp does — see /conversations/unread-summary above.
  // Best-effort: a slow/failed update here shouldn't block the thread
  // itself from loading.
  pool
    .query(`UPDATE conversations SET last_read_at = now() WHERE id = $1 AND organization_id = $2`, [req.params.id, org])
    .catch((err) => console.error('[inbox-service] failed to bump last_read_at (non-fatal):', err.message));

  res.json({ ...conv.rows[0], messages: msgs.rows });
});

// Post a reply (outbound message).
//
// FIX: for channel_type='email' this used to only insert a row into the
// local `messages` table — nothing was ever actually emailed, since
// email-service (the only thing that calls the Gmail API) was never
// invoked. email-service's POST /email/messages/reply already sends via
// Gmail AND mirrors itself into these same shared conversations/messages
// tables (see emailConversationStore.recordEmailMessage), so for email we
// now forward there instead of writing our own duplicate local-only row.
// Other channels (WhatsApp/SMS/etc.) are unchanged for now.
app.post('/conversations/:id/reply', canWrite, async (req, res) => {
  const org = req.user.organizationId;
  const { body } = req.body;

  const { rows: convRows } = await pool.query(
    `SELECT channel_type FROM conversations WHERE id=$1 AND organization_id=$2`,
    [req.params.id, org]
  );
  if (!convRows.length) return res.status(404).json({ error: 'Conversation not found' });

  if (convRows[0].channel_type === 'email') {
    const { rows: threadRows } = await pool.query(
      `SELECT id FROM email_threads WHERE conversation_id=$1 AND organization_id=$2
        ORDER BY last_message_time DESC NULLS LAST LIMIT 1`,
      [req.params.id, org]
    );
    if (!threadRows.length) {
      return res.status(409).json({ error: 'No connected email thread found for this conversation.' });
    }

    let emailRes;
    try {
      emailRes = await fetch(`${EMAIL_SERVICE_URL}/email/messages/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward the caller's own JWT — email-service authenticates
          // every request itself and needs req.user.organizationId.
          Authorization: req.headers.authorization,
        },
        body: JSON.stringify({ emailThreadId: threadRows[0].id, text: body }),
      });
    } catch (err) {
      console.error('[inbox-service] email-service unreachable:', err.message);
      return res.status(502).json({ error: 'Could not reach email-service to send this reply.' });
    }

    const payload = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok) {
      return res.status(emailRes.status).json({ error: payload.error || 'Failed to send email reply.' });
    }

    logAudit(req, 'inbox.reply', { conversationId: req.params.id, channel: 'email' });
    // email-service already inserted the real row into `messages` — fetch
    // it back so the response shape matches what the frontend expects.
    const { rows: sent } = await pool.query(
      `SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );
    return res.status(201).json(sent[0] || payload);
  }

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