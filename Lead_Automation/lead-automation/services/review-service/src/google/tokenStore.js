const { pool } = require('@lead/shared');
const { encrypt, decrypt } = require('./crypto');
const { refreshAccessToken } = require('./oauthClient');

// Refresh a bit before actual expiry to avoid racing a request against a
// token that expires mid-flight.
const EXPIRY_SKEW_MS = 60 * 1000;

// connected_by is a nice-to-have audit trail, not a hard requirement — a
// browser can hold a login token whose userId no longer exists (e.g. the DB
// was reseeded since login), which would otherwise trip the FK constraint
// and fail the whole connect flow. Falling back to NULL keeps the
// connection working; the user can just reconnect after logging back in if
// they want the attribution to be accurate.
async function resolveConnectedBy(userId) {
  if (!userId) return null;
  const { rows } = await pool.query(`SELECT 1 FROM users WHERE id=$1`, [userId]);
  return rows[0] ? userId : null;
}

async function saveTokens(organizationId, userId, tokenResponse) {
  const { access_token, expires_in, refresh_token, scope } = tokenResponse;
  const expiresAt = new Date(Date.now() + (Number(expires_in) || 3600) * 1000);
  const connectedBy = await resolveConnectedBy(userId);

  if (refresh_token) {
    // Google only returns refresh_token on the *first* consent (or when
    // prompt=consent forces re-consent, which buildAuthUrl always does) —
    // so we always have one here, but guard anyway for safety.
    const { rows } = await pool.query(
      `INSERT INTO google_tokens (organization_id, access_token, access_expires_at, refresh_token, scope, connected_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (organization_id) DO UPDATE SET
         access_token=EXCLUDED.access_token,
         access_expires_at=EXCLUDED.access_expires_at,
         refresh_token=EXCLUDED.refresh_token,
         scope=EXCLUDED.scope,
         connected_by=EXCLUDED.connected_by,
         updated_at=now()
       RETURNING *`,
      [organizationId, access_token, expiresAt, encrypt(refresh_token), scope || null, connectedBy]
    );
    return rows[0];
  }

  const { rows } = await pool.query(
    `UPDATE google_tokens SET access_token=$2, access_expires_at=$3, updated_at=now()
     WHERE organization_id=$1 RETURNING *`,
    [organizationId, access_token, expiresAt]
  );
  return rows[0];
}

async function getTokenRow(organizationId) {
  const { rows } = await pool.query(
    `SELECT * FROM google_tokens WHERE organization_id=$1`,
    [organizationId]
  );
  return rows[0] || null;
}

// Returns a valid access token, refreshing against Google first if the
// stored one is missing/expired. Throws (401) if there's no connection, or
// if the refresh token itself has been revoked — callers surface that as
// "reconnect your Google account".
async function getValidAccessToken(organizationId) {
  const row = await getTokenRow(organizationId);
  if (!row) {
    const err = new Error('Google Business Profile is not connected for this organization');
    err.status = 404;
    throw err;
  }

  const expiresAt = row.access_expires_at ? new Date(row.access_expires_at).getTime() : 0;
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
        `UPDATE google_tokens SET last_sync_status='error', last_sync_error=$2, updated_at=now() WHERE organization_id=$1`,
        [organizationId, 'Refresh token invalid or revoked — please reconnect Google Business Profile.']
      );
    }
    throw e;
  }
}

async function recordSyncResult(organizationId, { ok, error }) {
  await pool.query(
    `UPDATE google_tokens SET last_sync_at=now(), last_sync_status=$2, last_sync_error=$3, updated_at=now()
     WHERE organization_id=$1`,
    [organizationId, ok ? 'ok' : 'error', ok ? null : String(error || 'Unknown error')]
  );
}

async function disconnect(organizationId) {
  await pool.query(`DELETE FROM google_tokens WHERE organization_id=$1`, [organizationId]);
}

async function allConnectedOrganizationIds() {
  const { rows } = await pool.query(`SELECT organization_id FROM google_tokens`);
  return rows.map((r) => r.organization_id);
}

module.exports = {
  saveTokens,
  getTokenRow,
  getValidAccessToken,
  recordSyncResult,
  disconnect,
  allConnectedOrganizationIds,
};