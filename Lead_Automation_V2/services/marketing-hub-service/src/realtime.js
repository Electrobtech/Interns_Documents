/**
 * src/realtime.js
 *
 * Live delivery of recipient status changes to the frontend. Structurally
 * identical to inbox-service's src/realtime.js — same LISTEN/NOTIFY +
 * Socket.io shape, different channel/rooms:
 *
 *  1. A dedicated `pg` Client (not the shared pool — LISTEN needs to stay on
 *     one held-open connection) LISTENs on 'marketing_hub_channel', backed
 *     by the notify_mh_recipient_update() trigger on mh_recipients (see
 *     infra/db/schema.sql's "Marketing Hub" section). Fires on every insert
 *     or status change to a recipient row, regardless of which part of this
 *     service wrote it (the worker's send, or deliverySimulator's later
 *     delivered/read/replied progression).
 *
 *  2. A Socket.io server mounted at '/marketing-hub/socket.io' — NOT the
 *     bare '/socket.io', which the gateway already routes exclusively to
 *     inbox-service (see api-gateway/src/index.js's route table; the first
 *     registered match wins). Clients authenticate on connect with their
 *     existing CRM JWT, get auto-joined to `org:<organizationId>` for
 *     list-view badges, and separately ask to join `mh-campaign:<id>` rooms
 *     (ownership-checked) when a campaign/broadcast detail view is open,
 *     for its live per-recipient status table.
 *
 * The other event this service emits — `campaign:updated` (aggregate
 * sent/delivered/read/replied/failed counters) — is fired directly by
 * services/mhWorker.js's refreshCampaignCounters() after each DB write,
 * not routed through this LISTEN/NOTIFY path: the worker is the only writer
 * of those aggregates, so there's no cross-process fan-out need for that
 * particular event the way there is for `messages_channel` (written by up
 * to three different services in the inbox case).
 */
const { Server } = require('socket.io');
const { Client } = require('pg');
const { pool, verify } = require('@lead/shared');

function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    path: '/marketing-hub/socket.io',
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

    // Only let a socket listen to a campaign's live recipient table if that
    // campaign actually belongs to the caller's org.
    socket.on('join:campaign', async (campaignId, ack) => {
      try {
        const { rows } = await pool.query(
          `SELECT id FROM mh_campaigns WHERE id = $1 AND organization_id = $2`,
          [campaignId, socket.user.organizationId]
        );
        if (!rows.length) return ack?.({ ok: false });
        socket.join(`mh-campaign:${campaignId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false });
      }
    });

    socket.on('leave:campaign', (campaignId) => {
      socket.leave(`mh-campaign:${campaignId}`);
    });
  });

  startListener(io);
  return io;
}

async function startListener(io) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  client.on('error', (err) => {
    // A dropped LISTEN connection would otherwise silently stop delivering
    // live updates — reconnect rather than let that happen unnoticed.
    // Recipient rows are always still readable on refresh either way, since
    // this only powers the live push, not storage.
    console.error('[mh-realtime] LISTEN connection error, reconnecting in 5s:', err.message);
    setTimeout(() => startListener(io), 5000);
  });

  await client.connect();
  await client.query('LISTEN marketing_hub_channel');
  console.log('[mh-realtime] Listening for recipient updates on marketing_hub_channel');

  client.on('notification', (msg) => {
    try {
      const { recipient_id: recipientId, campaign_id: campaignId, organization_id: organizationId, status } = JSON.parse(msg.payload);
      io.to(`mh-campaign:${campaignId}`).emit('recipient:updated', { recipientId, campaignId, status });
      // Also a light org-wide ping — cheap enough to send unconditionally,
      // and lets a list view redraw a single row's status dot without
      // waiting for the next full aggregate `campaign:updated` event.
      io.to(`org:${organizationId}`).emit('recipient:status', { campaignId, recipientId, status });
    } catch (err) {
      console.error('[mh-realtime] failed to process notification (non-fatal):', err.message);
    }
  });
}

module.exports = { attachRealtime };
