/**
 * src/services/crypto.js
 *
 * Field-level encryption for email_accounts.access_token / refresh_token
 * (the Gmail OAuth tokens), same AES-256-GCM approach as
 * integration-service/src/services/crypto.js and
 * review-service/src/google/crypto.js — kept as its own small copy
 * (rather than a shared dependency) so this service has no coupling to
 * either of those services' env vars/keys.
 *
 * EMAIL_TOKEN_ENC_KEY should be a 32-byte key, hex or base64 encoded.
 * Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * If unset, tokens are stored in plain text and a warning is logged once —
 * keeps local/dev setups working without extra config, while making the
 * production expectation obvious.
 */

const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function loadKey() {
  const raw = process.env.EMAIL_TOKEN_ENC_KEY || '';
  if (!raw) return null;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    // fall through to warning below
  }
  console.warn('[email-service/crypto] EMAIL_TOKEN_ENC_KEY is set but is not a valid 32-byte key (hex or base64) — falling back to plain-text token storage.');
  return null;
}

const KEY = loadKey();
if (!KEY) {
  console.warn('[email-service/crypto] EMAIL_TOKEN_ENC_KEY not set — Gmail OAuth tokens will be stored in plain text. Set a 32-byte key in production.');
}

function encrypt(plainText) {
  if (!KEY || plainText == null) return plainText;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(stored) {
  if (stored == null) return stored;
  if (!stored.startsWith(PREFIX)) return stored; // legacy/plain-text value
  if (!KEY) throw new Error('Cannot decrypt stored Gmail token: EMAIL_TOKEN_ENC_KEY is not set');
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
