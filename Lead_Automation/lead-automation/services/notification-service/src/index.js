const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

// ---------- In-memory store (dummy backend — no DB) ----------
// A plain array is fine for a stub: it resets on restart and doesn't
// survive multiple replicas. Swap for a `notifications` table (scoped by
// organization_id, same pattern as every other service's Postgres tables)
// the moment this needs to be real.
const notifications = [];
const MAX_STORED = 100;

app.get('/health', (_req, res) => res.json({ service: 'notification', ok: true }));

// ---------- Dummy click notification ----------
// Receives a "UI element was clicked" ping from the frontend, simulates
// processing it (in a real service this is where you'd fan it out to a
// queue, push it over a websocket, persist it, etc.), stores it in memory,
// and echoes back a structured acknowledgement.
app.post('/notifications/click', (req, res) => {
  const { source, label } = req.body || {};

  const notification = {
    id: crypto.randomUUID(),
    type: 'ui_click',
    source: source || 'unknown',
    label: label || null,
    organizationId: req.user?.organizationId || null,
    userId: req.user?.userId || null,
    receivedAt: new Date().toISOString(),
    read: false,
  };

  console.log('[notification-service] click notification received:', notification);

  notifications.unshift(notification);
  notifications.length = Math.min(notifications.length, MAX_STORED);

  res.status(201).json({ ok: true, notification });
});

// ---------- List notifications (powers the bell dropdown) ----------
// Scoped by organizationId like every other service, newest first.
app.get('/notifications', (req, res) => {
  const orgId = req.user?.organizationId;
  const list = notifications.filter((n) => n.organizationId === orgId);
  const unreadCount = list.filter((n) => !n.read).length;
  res.json({ notifications: list, unreadCount });
});

// ---------- Mark all as read (called when the bell dropdown is opened) ----------
app.post('/notifications/read-all', (req, res) => {
  const orgId = req.user?.organizationId;
  for (const n of notifications) {
    if (n.organizationId === orgId) n.read = true;
  }
  res.json({ ok: true });
});

const PORT = process.env.NOTIFICATION_PORT || 4012;
app.listen(PORT, () => console.log(`notification-service on :${PORT}`));