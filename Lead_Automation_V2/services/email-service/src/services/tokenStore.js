/**
 * src/services/tokenStore.js
 *
 * Reads/writes the OAuth tokens on an email_accounts row, refreshing
 * against Google when the stored access token is missing/expired. Same
 * pattern as review-service/src/google/tokenStore.js, but keyed by
 * email_accounts.id rather than organization_id, since an organization
 * can connect more than one mailbox.
 */

const { pool } = require('@lead/shared');
const { encrypt, decrypt } = require('./crypto');
const { refreshAccessToken } = require('./oauthClient');

// Refresh a bit before actual expiry to avoid racing a request against a
// token that expires mid-flight.
const EXPIRY_SKEW_MS = 60 * 1000;

async function saveTokens(accountId, tokenResponse) {
  const { access_token, expires_in, refresh_token, scope } = tokenResponse;
  const expiresAt = new Date(Date.now() + (Number(expires_in) || 3600) * 1000);

  if (refresh_token) {
    const { rows } = await pool.query(
      `UPDATE email_accounts
          SET access_token=$2, token_expires_at=$3, refresh_token=$4, scope=$5, updated_at=now()
        WHERE id=$1 RETURNING *`,
      [accountId, encrypt(access_token), expiresAt, encrypt(refresh_token), scope || null]
    );
    return rows[0];
  }

  const { rows } = await pool.query(
    `UPDATE email_accounts SET access_token=$2, token_expires_at=$3, updated_at=now()
      WHERE id=$1 RETURNING *`,
    [accountId, encrypt(access_token), expiresAt]
  );
  return rows[0];
}

async function getAccountRow(accountId) {
  const { rows } = await pool.query(`SELECT * FROM email_accounts WHERE id=$1`, [accountId]);
  return rows[0] || null;
}

/**
 * Returns a valid (decrypted) access token for this mailbox, refreshing
 * against Google first if the stored one is missing/expired. Throws (401)
 * if the refresh token has been revoked — callers surface that as
 * "reconnect this mailbox".
 */
async function getValidAccessToken(accountId) {
  const row = await getAccountRow(accountId);
  if (!row) {
    const err = new Error('Email account not found.');
    err.status = 404;
    throw err;
  }

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return decrypt(row.access_token);
  }

  if (!row.refresh_token) {
    const err = new Error('This mailbox has no refresh token on file — please reconnect it.');
    err.status = 401;
    throw err;
  }

  try {
    const refreshed = await refreshAccessToken(decrypt(row.refresh_token));
    const updated = await saveTokens(accountId, refreshed);
    return decrypt(updated.access_token);
  } catch (err) {
    if (err.status === 401) {
      await pool.query(
        `UPDATE email_accounts SET connected=false, last_sync_error=$2, updated_at=now() WHERE id=$1`,
        [accountId, 'Refresh token invalid or revoked — please reconnect this mailbox.']
      );
    }
    throw err;
  }
}

module.exports = { saveTokens, getAccountRow, getValidAccessToken };
