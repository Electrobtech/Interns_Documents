// services/auth-service/src/controllers/pinController.js
//
// PIN-based login: a short numeric PIN a user can set up once they're
// signed in, then use afterwards as a faster alternative to typing their
// full password (POST /auth/verify-pin returns the same kind of token as
// POST /auth/login).
//
//   POST /auth/setup-pin        (authenticated) create/replace your PIN
//   GET  /auth/pin-status       (authenticated) created/expires dates for
//                                                the Settings › Security tab
//   POST /auth/verify-pin       (public)        log in with email + PIN
//   POST /auth/reset-pin-request (public)       forgot/expired PIN? re-prove
//                                                identity with your password
//                                                and set a new one in the
//                                                same request (auto-logs in
//                                                on success)
//
// Storage / lockout bookkeeping lives on users.pin_hash / is_pin_enabled /
// failed_pin_attempts / pin_lockout_until (see
// infra/db/migrations/017_pin_authentication.sql). Hashing mirrors
// password_hash in index.js: bcryptjs, same cost factor.
//
// Two extra rules layered on top (018_pin_expiration_history.sql):
//   - Expiration: a PIN older than 30 days (pin_updated_at) can no longer
//     complete verify-pin — the request is turned into a forced-reset
//     prompt instead of a token, so an old PIN is never quietly accepted.
//   - History: a new PIN can't just repeat the current or immediately-prior
//     one (users.previous_pin_hash), so "expired" can't be defeated by
//     re-entering the exact same digits.

const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { pool, sign, authenticate, logAuditRaw, permissionsForRoleId, withSystemAccess } = require('@lead/shared');
const { validatePin } = require('../validators');

const router = express.Router();

const BCRYPT_COST = 10; // matches password_hash in index.js
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const PIN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Belt-and-suspenders alongside the DB-tracked lockout: this caps *total*
// verify-pin traffic per IP so a distributed attacker can't just spread
// guesses across many accounts to dodge the per-account lockout.
const verifyPinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts from this network. Please try again shortly.' },
});

function minutesRemaining(lockoutUntil) {
  if (!lockoutUntil) return 0;
  const ms = new Date(lockoutUntil).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

// Computed from pin_updated_at rather than a stored is_pin_expired flag, so
// it can never go stale relative to the timestamp it's derived from.
function isPinExpired(pinUpdatedAt) {
  if (!pinUpdatedAt) return false; // never set = handled by is_pin_enabled, not expiry
  return Date.now() - new Date(pinUpdatedAt).getTime() > PIN_EXPIRY_MS;
}

// Rejects a new PIN that matches the current or immediately-prior one.
// Either hash may be null (e.g. first-ever PIN has no previous), in which
// case that comparison is simply skipped.
async function isReusedPin(newPin, currentHash, previousHash) {
  if (currentHash && (await bcrypt.compare(newPin, currentHash))) return true;
  if (previousHash && (await bcrypt.compare(newPin, previousHash))) return true;
  return false;
}

// ---- Setup / change PIN (must already be logged in with a password) ----
router.post('/auth/setup-pin', authenticate, async (req, res) => {
  const { pin } = req.body || {};
  const check = validatePin(String(pin ?? ''));
  if (!check.ok) return res.status(400).json({ error: check.error });

  const { rows } = await pool.query(
    `SELECT pin_hash, previous_pin_hash FROM users WHERE id = $1`,
    [req.user.userId]
  );
  if (await isReusedPin(String(pin), rows[0]?.pin_hash, rows[0]?.previous_pin_hash)) {
    return res.status(400).json({ error: 'New PIN cannot match your current or previous PIN' });
  }

  const hash = await bcrypt.hash(String(pin), BCRYPT_COST);
  await pool.query(
    `UPDATE users
        SET previous_pin_hash = pin_hash, pin_hash = $1, is_pin_enabled = true,
            failed_pin_attempts = 0, pin_lockout_until = NULL, pin_updated_at = now()
      WHERE id = $2`,
    [hash, req.user.userId]
  );
  await logAuditRaw(req.user.organizationId, req.user.userId, 'auth.pin_setup', {});
  res.json({ ok: true, isPinEnabled: true });
});

// ---- PIN status (for the Settings › Security "PIN Login" card) ----
// Read-only: reports whether a PIN is set, when it was created, when it
// expires, and how many days are left — all derived from pin_updated_at so
// there's nothing here that can drift out of sync with the enforcement
// logic in /auth/verify-pin above.
router.get('/auth/pin-status', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT is_pin_enabled, pin_updated_at FROM users WHERE id = $1`,
    [req.user.userId]
  );
  const user = rows[0] || {};

  if (!user.is_pin_enabled || !user.pin_updated_at) {
    return res.json({ isPinEnabled: false, createdAt: null, expiresAt: null, daysRemaining: null, isExpired: false });
  }

  const createdAt = new Date(user.pin_updated_at);
  const expiresAt = new Date(createdAt.getTime() + PIN_EXPIRY_MS);
  const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  res.json({
    isPinEnabled: true,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    daysRemaining, // may be negative if already expired
    isExpired: isPinExpired(user.pin_updated_at),
  });
});

// ---- Login with PIN ----
router.post('/auth/verify-pin', verifyPinRateLimiter, async (req, res) => {
  const { pin } = req.body || {};
  const email = req.body?.email?.trim().toLowerCase();
  if (!email || !pin) return res.status(400).json({ error: 'email & pin required' });

  // Same rationale as /auth/login: looking a user up by email alone, before
  // we know which org they belong to, so this runs with RLS bypassed. See
  // docs/MULTI_TENANT_RLS.md §2.5.
  const { rows } = await withSystemAccess(() =>
    pool.query(
      `SELECT u.id, u.organization_id, u.pin_hash, u.is_pin_enabled, u.role_id,
              u.failed_pin_attempts, u.pin_lockout_until, u.pin_updated_at, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1 LIMIT 1`,
      [email]
    )
  );

  // Same generic error whether the account doesn't exist, has no PIN set
  // up, or the PIN itself was wrong — don't leak which case it was.
  const genericError = { error: 'Invalid email or PIN' };
  if (!rows.length || !rows[0].is_pin_enabled || !rows[0].pin_hash) {
    return res.status(401).json(genericError);
  }

  const user = rows[0];
  const remaining = minutesRemaining(user.pin_lockout_until);
  if (remaining > 0) {
    return res.status(423).json({
      error: `Too many failed attempts. Try again in ${remaining} minute${remaining === 1 ? '' : 's'}.`,
      lockoutMinutesRemaining: remaining,
    });
  }

  const ok = await bcrypt.compare(String(pin), user.pin_hash);

  if (!ok) {
    const attempts = user.failed_pin_attempts + 1;
    const lockingNow = attempts >= MAX_FAILED_ATTEMPTS;
    await withSystemAccess(() =>
      pool.query(
        `UPDATE users
            SET failed_pin_attempts = $1,
                pin_lockout_until = $2
          WHERE id = $3`,
        [
          lockingNow ? 0 : attempts,
          lockingNow ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null,
          user.id,
        ]
      )
    );
    await withSystemAccess(() => logAuditRaw(user.organization_id, user.id, 'auth.pin_failed', { email }));
    if (lockingNow) {
      return res.status(423).json({
        error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
        lockoutMinutesRemaining: LOCKOUT_MINUTES,
      });
    }
    return res.status(401).json({
      ...genericError,
      attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts,
    });
  }

  await withSystemAccess(() =>
    pool.query(`UPDATE users SET failed_pin_attempts = 0, pin_lockout_until = NULL WHERE id = $1`, [user.id])
  );

  // The PIN itself was correct, but it's past its 30-day shelf life — don't
  // hand out a session token. Reset it to the login screen's "reset
  // required" step instead (frontend handles this via status ===
  // 'PIN_EXPIRED'); reset-pin-request completes the login once a fresh PIN
  // is set.
  if (isPinExpired(user.pin_updated_at)) {
    await withSystemAccess(() => logAuditRaw(user.organization_id, user.id, 'auth.pin_expired', { email }));
    return res.status(403).json({
      status: 'PIN_EXPIRED',
      message: 'Your PIN has expired after 30 days. Please set a new PIN.',
    });
  }

  const permissions = await permissionsForRoleId(user.role_id);
  const token = sign({ userId: user.id, organizationId: user.organization_id, role: user.role, permissions });
  await withSystemAccess(() => logAuditRaw(user.organization_id, user.id, 'auth.pin_login', { email }));
  res.json({ token });
});

// ---- Forgot/expired PIN: re-prove identity with password, set a new PIN,
// and log straight in (this is also what the login screen's "PIN expired"
// prompt calls to finish the login it interrupted) ----
router.post('/auth/reset-pin-request', async (req, res) => {
  const { password, newPin } = req.body || {};
  const email = req.body?.email?.trim().toLowerCase();
  if (!email || !password || !newPin) {
    return res.status(400).json({ error: 'email, password & newPin required' });
  }

  const check = validatePin(String(newPin));
  if (!check.ok) return res.status(400).json({ error: check.error });

  const { rows } = await withSystemAccess(() =>
    pool.query(
      `SELECT u.id, u.organization_id, u.password_hash, u.pin_hash, u.previous_pin_hash,
              u.role_id, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1 LIMIT 1`,
      [email]
    )
  );
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const user = rows[0];

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    await withSystemAccess(() => logAuditRaw(user.organization_id, user.id, 'auth.pin_reset_failed', { email }));
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (await isReusedPin(String(newPin), user.pin_hash, user.previous_pin_hash)) {
    return res.status(400).json({ error: 'New PIN cannot match your current or previous PIN' });
  }

  const hash = await bcrypt.hash(String(newPin), BCRYPT_COST);
  await withSystemAccess(() =>
    pool.query(
      `UPDATE users
          SET previous_pin_hash = pin_hash, pin_hash = $1, is_pin_enabled = true,
              failed_pin_attempts = 0, pin_lockout_until = NULL, pin_updated_at = now()
        WHERE id = $2`,
      [hash, user.id]
    )
  );
  await withSystemAccess(() => logAuditRaw(user.organization_id, user.id, 'auth.pin_reset', { email }));

  // Password re-proved identity just now, so complete the login rather
  // than making the person type their password a second time.
  const permissions = await permissionsForRoleId(user.role_id);
  const token = sign({ userId: user.id, organizationId: user.organization_id, role: user.role, permissions });
  res.json({ ok: true, token });
});

module.exports = router;