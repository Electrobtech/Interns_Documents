/**
 * src/realtime.js
 *
 * Live delivery of new messages to the frontend. Two pieces:
 *
 *  1. A dedicated `pg` Client (NOT the shared pool — LISTEN needs to stay
 *     on one held-open connection, whereas pool connections are handed
 *     back and reused) that LISTENs on 'messages_channel'. The trigger
 *     backing that channel (see infra/db/schema.sql's
 *     notify_new_message()) fires on every INSERT into `messages`,
 *     regardless of which service performed it — inbox-service's own
 *     POST /conversations/:id/reply, automation-service's
 *     messageRepository (real inbound WhatsApp/Instagram + bot replies),
 *     or integration-service's conversationStore (generic auto-reply
 *     path). So this one listener covers all three without any of them
 *     needing to know about Socket.io.
 *
 *  2. A Socket.io server mounted on the same HTTP server as the Express
 *     app. Clients authenticate on connect with their existing CRM JWT
 *     (same token useApi() already sends as a Bearer header) and get
 *     auto-joined to `org:<organizationId>` for conversation-list updates;
 *     they separately ask to join `conversation:<id>` rooms (checked
 *     against their org) when a thread view is open, for live-appended
 *     messages.
 */

const { Server } = require('socket.io');
const { Client } = require('pg');
const { pool, verify } = require('@lead/shared');

function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_ORIGIN || '*' },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('Missing token');
      socket.user = verify(token); // { userId, organizationId, role }
      next();
    } catch (err) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`org:${socket.user.organizationId}`);

    // Only let a socket listen to a conversation's live thread if that
    // conversation actually belongs to the caller's org — conversation
    // ids are UUIDs (not practically guessable), but this keeps a stray
    // guess from leaking another org's messages the way relying on
    // obscurity alone would.
    socket.on('join:conversation', async (conversationId, ack) => {
      try {
        const { rows } = await pool.query(
          `SELECT id FROM conversations WHERE id = $1 AND organization_id = $2`,
          [conversationId, socket.user.organizationId]
        );
        if (!rows.length) return ack?.({ ok: false });
        socket.join(`conversation:${conversationId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false });
      }
    });

    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });
  });

  startListener(io);
  return io;
}

async function startListener(io) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  client.on('error', (err) => {
    // A dropped LISTEN connection would otherwise just silently stop
    // delivering live updates — reconnect rather than let that happen
    // unnoticed. Real messages are always still readable on refresh
    // either way, since this only powers the live push, not storage.
    console.error('[realtime] LISTEN connection error, reconnecting in 5s:', err.message);
    setTimeout(() => startListener(io), 5000);
  });

  await client.connect();
  await client.query('LISTEN messages_channel');
  console.log('[realtime] Listening for new messages on messages_channel');

  client.on('notification', async (msg) => {
    try {
      const { id, conversation_id: conversationId, organization_id: organizationId } = JSON.parse(msg.payload);

      const { rows } = await pool.query(
        `SELECT m.id, m.conversation_id, m.direction, m.body, m.sender, m.message_type, m.metadata, m.created_at,
                c.channel_type, c.status, c.handled_by, c.last_message_at,
                ct.name AS contact_name
           FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
           LEFT JOIN contacts ct ON ct.id = c.contact_id
          WHERE m.id = $1`,
        [id]
      );
      if (!rows.length) return; // deleted between insert and notify (e.g. conversation reset) — nothing to broadcast
      const row = rows[0];

      // Full message for whoever has this exact conversation's thread open.
      io.to(`conversation:${conversationId}`).emit('message:new', row);

      // Lighter "a conversation changed" ping for list views (Unified
      // Inbox, Channels > WhatsApp) to bump the preview/sort/badges
      // without needing every message body.
      io.to(`org:${organizationId}`).emit('conversation:updated', {
        id: conversationId,
        channel_type: row.channel_type,
        status: row.status,
        handled_by: row.handled_by,
        last_message_at: row.last_message_at,
        contact_name: row.contact_name,
        last_message_preview: row.body,
        direction: row.direction,
      });
    } catch (err) {
      console.error('[realtime] failed to process notification (non-fatal):', err.message);
    }
  });
}

module.exports = { attachRealtime };
