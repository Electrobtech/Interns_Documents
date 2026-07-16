// services/auth-service/src/controllers/verificationController.js
//
// Step 5 "Verification" (and Step 1 email/mobile checks) of the
// registration wizard. Each endpoint does double duty:
//   - called with { email|mobile }            -> generates + "sends" an OTP
//   - called with { email|mobile, code }       -> verifies the OTP
// This keeps the API surface exactly at the two endpoints the product
// spec asks for (POST /verify/email, POST /verify/mobile) instead of
// splitting into four.
//
// No real SMS/email provider is wired up yet (that's an integration-service
// concern) — in development the generated code is returned in the response
// so the wizard can be exercised end-to-end; wire an email/SMS provider and
// remove `devCode` from the response before shipping to production.

const express = require('express');
const crypto = require('crypto');
const { pool } = require('@lead/shared');
const { isEmail, isPhone } = require('../validators');

const router = express.Router();

const CODE_TTL_MINUTES = 10;

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(100000, 999999));
}

async function sendCode(channel, target, res) {
  const code = generateCode();
  await pool.query(
    `INSERT INTO verification_codes (channel, target, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, 'signup', now() + interval '${CODE_TTL_MINUTES} minutes')`,
    [channel, target, hashCode(code)]
  );
  // TODO: send via email/SMS provider (integration-service) instead of returning it.
  res.status(201).json({
    sent: true,
    channel,
    target,
    expiresInMinutes: CODE_TTL_MINUTES,
    devCode: process.env.NODE_ENV === 'production' ? undefined : code,
  });
}

async function confirmCode(channel, target, code, res) {
  const { rows } = await pool.query(
    `SELECT id FROM verification_codes
      WHERE channel = $1 AND target = $2 AND code_hash = $3
        AND consumed = false AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1`,
    [channel, target, hashCode(String(code))]
  );
  if (!rows.length) return res.status(400).json({ verified: false, error: 'Invalid or expired code' });

  await pool.query(`UPDATE verification_codes SET consumed = true WHERE id = $1`, [rows[0].id]);
  await pool.query(
    `UPDATE users SET ${channel === 'email' ? 'is_email_verified' : 'is_phone_verified'} = true WHERE ${channel === 'email' ? 'email' : 'mobile'} = $1`,
    [target]
  );
  res.json({ verified: true, channel, target });
}

// POST /auth/verify/email  { email } -> send | { email, code } -> confirm
router.post('/auth/verify/email', async (req, res) => {
  const { email, code } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (code) return confirmCode('email', email.trim().toLowerCase(), code, res);
  return sendCode('email', email.trim().toLowerCase(), res);
});

// POST /auth/verify/mobile  { mobile } -> send | { mobile, code } -> confirm
router.post('/auth/verify/mobile', async (req, res) => {
  const { mobile, code } = req.body || {};
  if (!isPhone(mobile)) return res.status(400).json({ error: 'A valid mobile number is required' });
  if (code) return confirmCode('mobile', mobile.trim(), code, res);
  return sendCode('mobile', mobile.trim(), res);
});

module.exports = router;
