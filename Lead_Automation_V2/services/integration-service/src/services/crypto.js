/**
 * src/services/crypto.js
 *
 * Field-level encryption for the sensitive token fields inside the
 * `credentials` JSONB column on the `integrations` table:
 *   - page_access_token
 *   - long_lived_user_token
 *   - whatsapp_access_token
 *   - app_secret (Meta App Secret, when saved via manual entry — see
 *     routes/credentials.js)
 *
 * The rest of the credentials object (page_id, page_name, app_id,
 * instagram_business_account_id, token_expires_at, meta_user_id) is left
 * as plaintext on purpose, so it stays queryable/displayable (see
 * services/credentials.js:getCredentialsByMetaId, which filters on
 * credentials->>'page_id' / credentials->>'instagram_business_account_id',
 * and tokenRefreshJob.js, which reads token_expires_at directly).
 *
 * Uses AES-256-GCM: a random IV per encryption, and the GCM auth tag is
 * stored alongside the ciphertext so tampering is detectable on decrypt.
 *
 * Requires CREDENTIALS_ENCRYPTION_KEY in the environment - a 32-byte key,
 * base64-encoded. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV length for GCM
const ENC_PREFIX = 'enc:v1:'; // marks a value as ciphertext, so decrypt can tell it apart from legacy plaintext

function getKey() {
  const keyB64 = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY env var is not set.');
  }
  const key = Buffer.from(keyB64.trim(), 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).');
  }
  return key;
}

/**
 * Encrypts a single string value (a token). Returns
 * "enc:v1:<iv>:<authTag>:<ciphertext>" (iv/authTag/ciphertext hex-encoded),
 * suitable for storing as a string value inside a jsonb column.
 */
function encryptToken(plaintext) {
  if (plaintext == null) return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Reverses encryptToken(). Throws if the payload was tampered with or the
 * key doesn't match. If passed a value that isn't in our encrypted format
 * (e.g. a legacy plaintext token saved before this feature existed), it is
 * returned unchanged rather than throwing, so older rows don't hard-fail -
 * though such rows should be re-connected to get encryption-at-rest.
 */
function decryptToken(payload) {
  if (payload == null) return payload;
  if (typeof payload !== 'string' || !payload.startsWith(ENC_PREFIX)) {
    return payload; // not one of ours - treat as legacy plaintext
  }

  const key = getKey();
  const [ivHex, authTagHex, dataHex] = payload.slice(ENC_PREFIX.length).split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted token payload.');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

const TOKEN_FIELDS = ['page_access_token', 'long_lived_user_token', 'whatsapp_access_token', 'app_secret'];

/**
 * Returns a shallow copy of a credentials object with the two token
 * fields encrypted. All other fields pass through unchanged.
 */
function encryptCredentialTokens(credentials) {
  const copy = { ...credentials };
  for (const field of TOKEN_FIELDS) {
    if (copy[field] != null) copy[field] = encryptToken(copy[field]);
  }
  return copy;
}

/**
 * Returns a shallow copy of a credentials object with the two token
 * fields decrypted. All other fields pass through unchanged.
 */
function decryptCredentialTokens(credentials) {
  if (!credentials) return credentials;
  const copy = { ...credentials };
  for (const field of TOKEN_FIELDS) {
    if (copy[field] != null) copy[field] = decryptToken(copy[field]);
  }
  return copy;
}

module.exports = {
  encryptToken,
  decryptToken,
  encryptCredentialTokens,
  decryptCredentialTokens,
};
