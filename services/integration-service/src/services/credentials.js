/**
 * src/services/credentials.js
 *
 * Single source of truth for reading the saved Meta connection
 * (Page + Instagram Business Account credentials) out of Postgres.
 * Used by routes/instagram.js, routes/facebook.js, services/metaService.js,
 * and controllers/webhookController.js — so there's exactly one place
 * that knows how these are stored.
 *
 * organizationId must be passed explicitly by the caller — normally
 * req.user.organizationId, populated by the @lead/shared `authenticate`
 * middleware from the caller's JWT. This is what makes connections
 * properly separated per organization instead of shared globally.
 */

const { pool } = require('@lead/shared');

/**
 * Fetch the most recent connected Meta integration row for a given org.
 * Returns the full credentials object: page_id, page_name,
 * page_access_token, instagram_business_account_id,
 * long_lived_user_token, token_expires_at, meta_user_id.
 */
async function getConnectedCredentials(organizationId) {
  if (!organizationId) {
    throw new Error('organizationId is required to look up a connection.');
  }

  const { rows } = await pool.query(
    `SELECT credentials FROM integrations
     WHERE organization_id = $1 AND provider = 'instagram' AND status = 'connected'
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId]
  );

  if (rows.length === 0) {
    throw new Error('No connected Meta integration found for this organization. Run /auth/facebook first.');
  }

  return rows[0].credentials;
}

/**
 * Fetch credentials by matching either the Page ID or Instagram Business
 * Account ID stored in the connection — used by incoming webhook events,
 * which identify the account via Meta's own IDs (entry.id in the payload),
 * not by organizationId. This is what lets a shared webhook endpoint route
 * an incoming event to the correct organization's connection.
 */
async function getCredentialsByMetaId(metaId) {
  if (!metaId) {
    throw new Error('metaId (Page ID or Instagram Business Account ID) is required.');
  }

  const { rows } = await pool.query(
    `SELECT organization_id, credentials FROM integrations
     WHERE provider = 'instagram' AND status = 'connected'
       AND (credentials->>'page_id' = $1 OR credentials->>'instagram_business_account_id' = $1)
     ORDER BY created_at DESC LIMIT 1`,
    [metaId]
  );

  if (rows.length === 0) {
    throw new Error(`No connected integration found matching Meta ID ${metaId}.`);
  }

  return { organizationId: rows[0].organization_id, credentials: rows[0].credentials };
}

module.exports = { getConnectedCredentials, getCredentialsByMetaId };