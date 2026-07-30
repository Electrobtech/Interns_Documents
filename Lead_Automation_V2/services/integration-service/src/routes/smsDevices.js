/**
 * src/routes/smsDevices.js
 *
 * Management routes for connected phones (each running a third-party SMS
 * forwarding app). Mounted in index.js as: app.use('/sms/devices', smsDevicesRoutes)
 * (after authenticate, so req.user.organizationId scopes every query and
 * RLS backs it up — see infra/db/rls.sql).
 *
 * GET /sms/devices                        list this org's connected phones
 * POST /sms/devices                       { label, phone_number? } -> creates a device + webhook URL, locked immediately
 * PUT /sms/devices/:id                    rename / update phone number (blocked while locked)
 * POST /sms/devices/:id/regenerate-token  invalidate old URL, issue a new one (blocked while locked)
 * DELETE /sms/devices/:id                 remove a phone (blocked while locked)
 * POST /sms/devices/:id/unlock            admin + admin password only — lifts the lock (see 017_sms_device_lock.sql)
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { pool, requireRole } = require('@lead/shared');
const { verifyUnlockPassword } = require('../services/credentials');

function webhookUrlFor(token) {
  // The forwarder app on the phone must hit the API GATEWAY (not
  // integration-service directly) — same requirement as GMAIL_REDIRECT_URI
  // and META_WEBHOOK_URL elsewhere in .env.
  const base = process.env.GATEWAY_PUBLIC_URL || `http://localhost:${process.env.GATEWAY_PORT || 8080}`;
  return `${base.replace(/\/$/, '')}/webhook/sms/${token}`;
}

function serialize(row) {
  if (!row) return null;
  return { ...row, webhook_url: webhookUrlFor(row.webhook_token), locked: row.locked_at != null };
}

// Shared lock check used by every mutating route below (PUT, regenerate-token,
// DELETE) — mirrors getConnectionLockState() in services/credentials.js for
// Meta/WhatsApp, just scoped to a single sms_devices row instead of the
// most-recent integrations row.
async function getDeviceLockState(id, organizationId) {
  const { rows } = await pool.query(
    `SELECT locked_at FROM sms_devices WHERE id=$1 AND organization_id=$2`,
    [id, organizationId]
  );
  if (!rows.length) return { found: false, locked: false };
  return { found: true, locked: rows[0].locked_at != null };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM sms_devices WHERE organization_id=$1 ORDER BY created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows.map(serialize));
});

router.post('/', async (req, res) => {
  const { label, phone_number } = req.body || {};
  if (!label || !label.trim()) return res.status(400).json({ error: 'A label is required (e.g. "Front desk phone").' });

  const token = crypto.randomBytes(32).toString('hex');
  // Locked immediately on creation, same as an Instagram/Facebook/WhatsApp
  // connect — an admin must explicitly unlock it (with the admin password)
  // before it can be renamed, re-tokened, or removed.
  const { rows } = await pool.query(
    `INSERT INTO sms_devices (organization_id, label, phone_number, webhook_token, created_by, locked_at, locked_by)
     VALUES ($1,$2,$3,$4,$5, now(), $5) RETURNING *`,
    [req.user.organizationId, label.trim(), phone_number || null, token, req.user.userId]
  );

  // Make the channel visible right away, even before the first text
  // arrives — same "no unique constraint, upsert by hand" reasoning as
  // smsForwarderService.js.
  const { rowCount } = await pool.query(
    `UPDATE channels SET status='connected' WHERE organization_id=$1 AND type='sms'`,
    [req.user.organizationId]
  );
  if (rowCount === 0) {
    await pool.query(
      `INSERT INTO channels (organization_id, type, display_name, status)
       VALUES ($1, 'sms', 'SMS / RCS', 'connected')`,
      [req.user.organizationId]
    );
  }

  res.status(201).json(serialize(rows[0]));
});

router.put('/:id', async (req, res) => {
  const lockState = await getDeviceLockState(req.params.id, req.user.organizationId);
  if (!lockState.found) return res.status(404).json({ error: 'Device not found.' });
  if (lockState.locked) {
    return res.status(403).json({ error: 'This device is locked. Ask an account admin to unlock it before editing.' });
  }

  const { label, phone_number } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE sms_devices SET label=COALESCE($1, label), phone_number=COALESCE($2, phone_number), updated_at=now()
      WHERE id=$3 AND organization_id=$4 RETURNING *`,
    [label, phone_number, req.params.id, req.user.organizationId]
  );
  res.json(serialize(rows[0]) || {});
});

router.post('/:id/regenerate-token', async (req, res) => {
  const lockState = await getDeviceLockState(req.params.id, req.user.organizationId);
  if (!lockState.found) return res.status(404).json({ error: 'Device not found.' });
  if (lockState.locked) {
    return res.status(403).json({ error: 'This device is locked. Ask an account admin to unlock it before regenerating its token.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await pool.query(
    `UPDATE sms_devices SET webhook_token=$1, updated_at=now()
      WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [token, req.params.id, req.user.organizationId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Device not found.' });
  res.json(serialize(rows[0]));
});

/**
 * POST /sms/devices/:id/unlock  (admin only + admin password)
 * Lifts the lock set automatically on connect, same gate as
 * POST /auth/unlock and POST /whatsapp/unlock — being an admin is
 * necessary but not sufficient, the request must also include the correct
 * admin unlock password (see verifyUnlockPassword in services/credentials.js).
 */
router.post('/:id/unlock', requireRole('admin'), async (req, res) => {
  if (!verifyUnlockPassword(req.body?.password)) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  const { rows } = await pool.query(
    `UPDATE sms_devices SET locked_at=NULL, locked_by=NULL, updated_at=now()
      WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Device not found.' });
  res.json(serialize(rows[0]));
});

router.delete('/:id', async (req, res) => {
  const lockState = await getDeviceLockState(req.params.id, req.user.organizationId);
  if (!lockState.found) return res.status(404).json({ error: 'Device not found.' });
  if (lockState.locked) {
    return res.status(403).json({ error: 'This device is locked. Ask an account admin to unlock it before removing it.' });
  }

  await pool.query(`DELETE FROM sms_devices WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);

  const { rows: remaining } = await pool.query(
    `SELECT id FROM sms_devices WHERE organization_id=$1 LIMIT 1`,
    [req.user.organizationId]
  );
  if (!remaining.length) {
    await pool.query(
      `UPDATE channels SET status='disconnected' WHERE organization_id=$1 AND type='sms'`,
      [req.user.organizationId]
    );
  }

  res.json({ ok: true });
});

module.exports = router;