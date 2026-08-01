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

/**
 * Returns { connected, locked, lockedAt } for the most recent row of a
 * given org + provider, without decrypting credentials. Used by
 * status routes and by connect/update routes to check whether they're
 * allowed to make changes.
 */
async function getConnectionLockState(organizationId, provider) {
  const { rows } = await pool.query(
    `SELECT id, status, locked_at FROM integrations
     WHERE organization_id = $1 AND provider = $2
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, provider]
  );
  if (rows.length === 0) return { connected: false, locked: false, lockedAt: null, id: null };
  return {
    connected: rows[0].status === 'connected',
    locked: rows[0].locked_at != null,
    lockedAt: rows[0].locked_at,
    id: rows[0].id,
  };
}

/**
 * Locks the most recent row for a given org + provider (typically called
 * right after a connect/OAuth callback successfully verifies credentials).
 * lockedByUserId is nullable — a system-triggered auto-lock has no specific
 * user to attribute it to.
 */
async function lockConnection(organizationId, provider, lockedByUserId = null) {
  await pool.query(
    `UPDATE integrations SET locked_at = now(), locked_by = $1
     WHERE id = (
       SELECT id FROM integrations
       WHERE organization_id = $2 AND provider = $3
       ORDER BY created_at DESC LIMIT 1
     )`,
    [lockedByUserId, organizationId, provider]
  );
}

/**
 * Unlocks the most recent row for a given org + provider. Callers must
 * enforce their own admin-only access check before calling this —
 * see routes/instagram.js and routes/whatsapp.js POST /unlock.
 */
async function unlockConnection(organizationId, provider) {
  const { rowCount } = await pool.query(
    `UPDATE integrations SET locked_at = NULL, locked_by = NULL
     WHERE id = (
       SELECT id FROM integrations
       WHERE organization_id = $1 AND provider = $2
       ORDER BY created_at DESC LIMIT 1
     )`,
    [organizationId, provider]
  );
  return rowCount > 0;
}

/**
 * Password gate for unlocking a locked Meta/WhatsApp connection, on top of
 * the existing requireRole('admin') check on the route itself — being an
 * admin is not sufficient by itself, they must also know this password.
 * TEMPORARY: hardcoded placeholder value, overridable via env var so it can
 * be swapped for something real without a code change later.
 */
const UNLOCK_PASSWORD = process.env.INTEGRATIONS_UNLOCK_PASSWORD || '123';

function verifyUnlockPassword(password) {
  return typeof password === 'string' && password === UNLOCK_PASSWORD;
}

module.exports = {
  getConnectedCredentials,
  getCredentialsByMetaId,
  getConnectionLockState,
  lockConnection,
  unlockConnection,
  verifyUnlockPassword,
};