const express = require('express');
const cors = require('cors');
const { pool, authenticate, sign, withTenantScope, withSystemAccess } = require('@lead/shared');
const { pollAllOrganizations } = require('./followUpPoller');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'notification', ok: true }));

// ---------- Dummy click notification (unchanged contract) ----------
// Receives a "UI element was clicked" ping from the frontend. Kept as a
// real 'ui_click' row in the same `notifications` table used by the
// follow-up feature below, rather than a second store — one table, one
// GET /notifications, one bell dropdown.
app.post('/notifications/click', async (req, res) => {
  const { source, label } = req.body || {};
  const orgId = req.user.organizationId;

  const { rows } = await pool.query(
    `INSERT INTO notifications (organization_id, user_id, type, title, body, read)
     VALUES ($1, $2, 'ui_click', $3, $4, false)
     RETURNING *`,
    [orgId, req.user.userId || null, label || 'UI click', source || 'unknown']
  );
  const row = rows[0];

  console.log('[notification-service] click notification received:', row.id);

  // Response shape kept backward-compatible with the existing
  // NotificationClickDemo.jsx component, which reads .notification.id /
  // .notification.receivedAt / .notification.source / .notification.label.
  res.status(201).json({
    ok: true,
    notification: {
      id: row.id,
      type: row.type,
      source: row.body,
      label: row.title,
      organizationId: row.organization_id,
      userId: row.user_id,
      receivedAt: row.created_at,
      read: row.read,
    },
  });
});

// ---------- List notifications (powers the bell dropdown) ----------
// Scoped by organizationId (both by the app-level WHERE clause here and,
// as a backstop, by Postgres RLS — see infra/db/rls.sql), newest first.
// Joins in the contact name + follow-up due date so the dropdown can
// render "Follow-up due today — <contact>" without a second round trip.
app.get('/notifications', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, c.name AS contact_name, f.due_at AS follow_up_due_at
         FROM notifications n
         LEFT JOIN contacts c   ON c.id = n.contact_id
         LEFT JOIN follow_ups f ON f.id = n.follow_up_id
        WHERE n.organization_id = $1
        ORDER BY n.created_at DESC
        LIMIT 100`,
      [req.user.organizationId]
    );
    const unreadCount = rows.filter((n) => !n.read).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    console.error('[notification-service] GET /notifications failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Mark all as read (called when the bell dropdown is opened, or via "mark all read") ----------
app.post('/notifications/read-all', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = true WHERE organization_id = $1 AND read = false`,
      [req.user.organizationId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[notification-service] POST /notifications/read-all failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.NOTIFICATION_PORT || 4012;
app.listen(PORT, () => console.log(`notification-service on :${PORT}`));

// ---------- Follow-up-due polling job ----------
// Not behind `authenticate` (it's a background job, not a request), and
// runs across every organization — this is exactly the "cross-tenant by
// design, one sanctioned call site" case withSystemAccess() exists for
// (see shared/src/db.js and docs/MULTI_TENANT_RLS.md §2.5) to list orgs,
// then withTenantScope() per-org for the actual inserts.
const POLL_INTERVAL_MS = Number(process.env.NOTIFICATION_POLL_INTERVAL_MS) || 60_000;
pollAllOrganizations({ pool, sign, withTenantScope, withSystemAccess })
  .catch((err) => console.error('[notification-service] initial poll failed:', err.message));
setInterval(() => {
  pollAllOrganizations({ pool, sign, withTenantScope, withSystemAccess })
    .catch((err) => console.error('[notification-service] poll cycle failed:', err.message));
}, POLL_INTERVAL_MS);

module.exports = app; // exported for tests, if any get added later
