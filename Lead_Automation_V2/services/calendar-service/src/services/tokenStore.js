/**
 * src/services/tokenStore.js
 *
 * One connected Google account per organization (unlike email-service,
 * which allows several mailboxes — here we only ever need "the org's
 * calendar" for booking meetings, campaign-send reminders, and
 * automation-flow delay nodes, so organization_id is the primary key
 * rather than a foreign key on a separate id).
 */

const { pool } = require('@lead/shared');
const { encrypt, decrypt } = require('./crypto');
const { refreshAccessToken } = require('./oauthClient');

// Refresh a bit before actual expiry to avoid racing a request against a
// token that expires mid-flight.
const EXPIRY_SKEW_MS = 60 * 1000;

async function resolveConnectedBy(userId) {
  if (!userId) return null;
  const { rows } = await pool.query(`SELECT 1 FROM users WHERE id=$1`, [userId]);
  return rows[0] ? userId : null;
}

async function saveTokens(organizationId, userId, tokenResponse, extra = {}) {
  const { access_token, expires_in, refresh_token, scope } = tokenResponse;
  const expiresAt = new Date(Date.now() + (Number(expires_in) || 3600) * 1000);
  const connectedBy = await resolveConnectedBy(userId);

  if (refresh_token) {
    const { rows } = await pool.query(
      `INSERT INTO calendar_accounts (organization_id, google_email, access_token, refresh_token, token_expires_at, scope, connected_by, connected)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       ON CONFLICT (organization_id) DO UPDATE SET
         google_email=COALESCE(EXCLUDED.google_email, calendar_accounts.google_email),
         access_token=EXCLUDED.access_token,
         token_expires_at=EXCLUDED.token_expires_at,
         refresh_token=EXCLUDED.refresh_token,
         scope=EXCLUDED.scope,
         connected_by=EXCLUDED.connected_by,
         connected=true,
         updated_at=now()
       RETURNING *`,
      [organizationId, extra.email || null, access_token, encrypt(refresh_token), expiresAt, scope || null, connectedBy]
    );
    return rows[0];
  }

  const { rows } = await pool.query(
    `UPDATE calendar_accounts SET access_token=$2, token_expires_at=$3, updated_at=now()
     WHERE organization_id=$1 RETURNING *`,
    [organizationId, access_token, expiresAt]
  );
  return rows[0];
}

async function getAccount(organizationId) {
  const { rows } = await pool.query(`SELECT * FROM calendar_accounts WHERE organization_id=$1`, [organizationId]);
  return rows[0] || null;
}

/**
 * Returns a valid access token, refreshing against Google first if the
 * stored one is missing/expired. Throws (404) if there's no connection, or
 * (401) if the refresh token itself has been revoked — callers surface
 * that as "reconnect Google Calendar".
 */
async function getValidAccessToken(organizationId) {
  const row = await getAccount(organizationId);
  if (!row || !row.connected) {
    const err = new Error('Google Calendar is not connected for this organization');
    err.status = 404;
    throw err;
  }

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return row.access_token;
  }

  try {
    const refreshed = await refreshAccessToken(decrypt(row.refresh_token));
    const updated = await saveTokens(organizationId, row.connected_by, refreshed);
    return updated.access_token;
  } catch (e) {
    if (e.status === 401) {
      await pool.query(
        `UPDATE calendar_accounts SET connected=false, last_error=$2, updated_at=now() WHERE organization_id=$1`,
        [organizationId, 'Refresh token invalid or revoked — please reconnect Google Calendar.']
      );
    }
    throw e;
  }
}

async function disconnect(organizationId) {
  await pool.query(
    `UPDATE calendar_accounts SET connected=false, access_token=NULL, refresh_token=NULL, updated_at=now() WHERE organization_id=$1`,
    [organizationId]
  );
}

module.exports = { saveTokens, getAccount, getValidAccessToken, disconnect };
