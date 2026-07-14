/**
 * src/services/crypto.js
 *
 * Encrypts/decrypts the credentials object before it goes into the
 * `encrypted_credentials` column (routes/auth.js writes both a plaintext
 * searchable `credentials` metadata blob with no tokens, and this
 * encrypted blob with the real tokens).
 *
 * Uses AES-256-GCM: a random IV per encryption, and the GCM auth tag is
 * stored alongside the ciphertext so tampering is detectable on decrypt.
 *
 * Requires CREDENTIALS_ENCRYPTION_KEY in the environment — a 32-byte key,
 * base64-encoded. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV length for GCM

function getKey() {
  const keyB64 = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY env var is not set.');
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

/**
 * Encrypts a JS object. Returns a string in the form
 * "<iv>:<authTag>:<ciphertext>" (all hex-encoded) suitable for storing in
 * a text/jsonb column.
 */
function encryptCredentials(obj) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(obj);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Reverses encryptCredentials(). Throws if the payload was tampered with
 * or the key doesn't match.
 */
function decryptCredentials(payload) {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted credentials payload.');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = { encryptCredentials, decryptCredentials };