const { pool } = require('@lead/shared');
const { encrypt, decrypt } = require('./crypto');

// Per-tenant Google OAuth client credentials, so each organization can use
// its own Google Cloud OAuth client instead of sharing the single
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET pair from the backend .env.
// The client secret is encrypted at rest with the same AES-256-GCM helper
// used for refresh tokens (see ./crypto.js) and is never returned to the
// frontend once saved.

async function getConfig(organizationId) {
  const { rows } = await pool.query(
    `SELECT client_id AS "clientId", encrypted_client_secret AS "encryptedClientSecret",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM google_oauth_configs WHERE organization_id=$1`,
    [organizationId]
  );
  return rows[0] || null;
}

// Decrypted { clientId, clientSecret } for this tenant only, or null if the
// tenant hasn't configured its own credentials yet.
async function getDecryptedCredentials(organizationId) {
  const row = await getConfig(organizationId);
  if (!row) return null;
  return { clientId: row.clientId, clientSecret: decrypt(row.encryptedClientSecret) };
}

// Resolves the credentials to use for a tenant: its own saved config if
// present, otherwise the global GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env
// vars (kept as a fallback so existing single-tenant deployments that never
// configure per-tenant credentials keep working unchanged). Returns null if
// neither is available.
async function resolveCredentials(organizationId) {
  const tenantCreds = await getDecryptedCredentials(organizationId);
  if (tenantCreds) return tenantCreds;
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
  }
  return null;
}

// Upsert — one config per tenant (UNIQUE (organization_id) at the DB level
// backs this with ON CONFLICT, so "prevent duplicate configs per tenant" is
// enforced even under concurrent requests, not just in application code).
async function saveConfig(organizationId, clientId, clientSecret) {
  const { rows } = await pool.query(
    `INSERT INTO google_oauth_configs (organization_id, client_id, encrypted_client_secret)
     VALUES ($1,$2,$3)
     ON CONFLICT (organization_id) DO UPDATE SET
       client_id=EXCLUDED.client_id,
       encrypted_client_secret=EXCLUDED.encrypted_client_secret,
       updated_at=now()
     RETURNING client_id AS "clientId", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [organizationId, clientId, encrypt(clientSecret)]
  );
  return rows[0];
}

module.exports = { getConfig, getDecryptedCredentials, resolveCredentials, saveConfig };
