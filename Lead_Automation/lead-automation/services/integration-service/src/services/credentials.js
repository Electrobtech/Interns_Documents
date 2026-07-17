/**
 * src/services/credentials.js
 *
 * Single source of truth for reading saved connections (Meta Page +
 * Instagram, and now WhatsApp) out of Postgres. Used by routes/instagram.js,
 * routes/facebook.js, routes/whatsapp.js, services/metaService.js,
 * services/whatsappService.js, and controllers/webhookController.js — so
 * there's exactly one place that knows how these are stored.
 *
 * organizationId must be passed explicitly by the caller — normally
 * req.user.organizationId, populated by the @lead/shared `authenticate`
 * middleware from the caller's JWT. This is what makes connections
 * properly separated per organization instead of shared globally.
 */

const { pool, withSystemAccess } = require('@lead/shared');
const { decryptCredentialTokens } = require('./crypto');

/**
 * Fetch the most recent connected integration row for a given org + provider.
 * provider defaults to 'instagram' for backwards compatibility with the
 * existing Facebook/Instagram callers.
 *
 * Instagram/Facebook rows: page_id, page_name, page_access_token,
 *   instagram_business_account_id, long_lived_user_token,
 *   token_expires_at, meta_user_id.
 * WhatsApp rows: phone_number_id, whatsapp_business_account_id,
 *   whatsapp_access_token, display_phone_number, verified_name.
 */
async function getConnectedCredentials(organizationId, provider = 'instagram') {
  if (!organizationId) {
    throw new Error('organizationId is required to look up a connection.');
  }

  const { rows } = await pool.query(
    `SELECT credentials FROM integrations
     WHERE organization_id = $1 AND provider = $2 AND status = 'connected'
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, provider]
  );

  if (rows.length === 0) {
    const hint = provider === 'whatsapp' ? 'POST /whatsapp/connect' : '/auth/facebook';
    throw new Error(`No connected ${provider} integration found for this organization. Run ${hint} first.`);
  }

  return decryptCredentialTokens(rows[0].credentials);
}

/**
 * Fetch credentials by matching an ID Meta itself sends us — used by
 * incoming webhook events, which identify the account via Meta's own IDs
 * (entry.id in the payload), not by organizationId. This is what lets a
 * shared webhook endpoint route an incoming event to the correct
 * organization's connection, for either provider.
 *
 * Matches, depending on provider:
 *   instagram -> credentials.page_id OR credentials.instagram_business_account_id
 *   whatsapp  -> credentials.whatsapp_business_account_id (entry.id in a
 *                WhatsApp webhook payload is always the WABA ID, not the
 *                phone number ID)
 */
async function getCredentialsByMetaId(metaId) {
  if (!metaId) {
    throw new Error('metaId (Page ID, Instagram Business Account ID, or WABA ID) is required.');
  }

  // This is the webhook-side equivalent of a login lookup: we don't know
  // which organization owns this event until after we've scanned across
  // all of them by Meta's own id, so it runs under withSystemAccess (see
  // infra/db/rls.sql) rather than a normal tenant-scoped query.
  const { rows } = await withSystemAccess(() => pool.query(
    `SELECT organization_id, provider, credentials FROM integrations
     WHERE status = 'connected'
       AND (
         (provider = 'instagram' AND (credentials->>'page_id' = $1 OR credentials->>'instagram_business_account_id' = $1))
         OR (provider = 'whatsapp' AND credentials->>'whatsapp_business_account_id' = $1)
       )
     ORDER BY created_at DESC LIMIT 1`,
    [metaId]
  ));

  if (rows.length === 0) {
    throw new Error(`No connected integration found matching Meta ID ${metaId}.`);
  }

  return {
    organizationId: rows[0].organization_id,
    provider: rows[0].provider,
    credentials: decryptCredentialTokens(rows[0].credentials),
  };
}

module.exports = { getConnectedCredentials, getCredentialsByMetaId };
