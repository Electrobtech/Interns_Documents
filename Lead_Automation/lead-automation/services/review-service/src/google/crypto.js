const crypto = require('crypto');

// Refresh tokens are the long-lived credential for a customer's Google
// Business Profile, so we encrypt them at rest rather than storing plain
// text (unlike e.g. integration-service's `credentials` JSONB, which only
// ever holds low-sensitivity provider config).
//
// GOOGLE_TOKEN_ENC_KEY should be a 32-byte key, hex or base64 encoded.
// If it's not set we fall back to storing plain text and log a warning —
// that keeps local/dev setups working without extra config, while still
// making the production expectation obvious.
const RAW_KEY = process.env.GOOGLE_TOKEN_ENC_KEY || '';

function loadKey() {
  if (!RAW_KEY) return null;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(RAW_KEY)) return Buffer.from(RAW_KEY, 'hex');
    const b64 = Buffer.from(RAW_KEY, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    // fall through to warning below
  }
  console.warn('[review-service/google] GOOGLE_TOKEN_ENC_KEY is set but is not a valid 32-byte key (hex or base64) — falling back to plain-text token storage.');
  return null;
}

const KEY = loadKey();
if (!KEY) {
  console.warn('[review-service/google] GOOGLE_TOKEN_ENC_KEY not set — Google refresh tokens will be stored in plain text. Set a 32-byte key in production.');
}

const PREFIX = 'enc:v1:';

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
  if (!KEY) throw new Error('Cannot decrypt stored Google token: GOOGLE_TOKEN_ENC_KEY is not set');
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
