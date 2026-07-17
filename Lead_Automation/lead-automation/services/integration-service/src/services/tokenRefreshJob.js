/**
 * src/services/tokenRefreshJob.js
 *
 * Keeps saved Meta connections alive by refreshing the long-lived user
 * token before it expires (~60 days from issue). Facebook allows refreshing
 * anytime after the token is 24h old, extending it another ~60 days each time.
 *
 * Without this, a connection would silently stop working ~60 days after
 * the user connected, with no warning until a publish call starts failing.
 *
 * Exports:
 *   - refreshExpiringTokens(): runs one pass immediately, used by both the
 *     scheduled job and the manual-trigger route in routes/auth.js
 *   - startTokenRefreshScheduler(): registers the daily cron job
 */

const cron = require('node-cron');
const { pool, withSystemAccess } = require('@lead/shared');
const { GRAPH_URL, getAppSecretProof } = require('./graphApi');
const { encryptCredentialTokens, decryptCredentialTokens } = require('./crypto');

// Refresh anything expiring within the next 10 days, so there's always
// comfortable buffer even if the job doesn't run for a day or two.
const REFRESH_WINDOW_DAYS = 10;

async function refreshExpiringTokens() {
  console.log('[token-refresh] Checking for tokens nearing expiry...');

  // This scans + updates across every organization's connections, not just
  // one, so the whole pass runs under withSystemAccess (see
  // infra/db/rls.sql) rather than a normal tenant-scoped request — there's
  // no single req.user here, this is a cron job.
  return withSystemAccess(() => refreshExpiringTokensInner());
}

async function refreshExpiringTokensInner() {
  const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // credentials->>'token_expires_at' pulls the stored expiry out of the
  // JSONB column as text for comparison. Only 'instagram' provider rows
  // currently hold Meta connections (see routes/auth.js).
  const { rows } = await pool.query(
    `SELECT id, credentials FROM integrations
     WHERE provider = 'instagram'
       AND status = 'connected'
       AND (credentials->>'token_expires_at') IS NOT NULL
       AND (credentials->>'token_expires_at')::timestamptz < $1`,
    [cutoff]
  );

  if (rows.length === 0) {
    console.log('[token-refresh] No tokens need refreshing right now.');
    return { checked: 0, refreshed: 0, failed: 0 };
  }

  console.log(`[token-refresh] Found ${rows.length} token(s) nearing expiry.`);

  let refreshed = 0;
  let failed = 0;

  for (const row of rows) {
    // Row came straight from Postgres, not through services/credentials.js,
    // so the two token fields are still ciphertext at this point.
    const creds = decryptCredentialTokens(row.credentials);
    const currentToken = creds.long_lived_user_token;

    if (!currentToken) {
      console.warn(`[token-refresh] Row ${row.id} has no long_lived_user_token, skipping.`);
      failed++;
      continue;
    }

    try {
      const proof = getAppSecretProof(currentToken);
      const refreshRes = await fetch(`${GRAPH_URL}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: currentToken,
        }) + `&appsecret_proof=${proof}`);
      const refreshData = await refreshRes.json();

      if (refreshData.error) {
        console.error(`[token-refresh] Refresh failed for row ${row.id}:`, refreshData.error);
        failed++;
        continue;
      }

      const expiresInSeconds = refreshData.expires_in || 5184000;
      const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

      const updatedCredentials = {
        ...creds,
        long_lived_user_token: refreshData.access_token,
        token_expires_at: newExpiresAt,
      };

      // page_access_token isn't touched by this refresh (only the user
      // token is refreshed here), so re-encrypt it back to ciphertext too -
      // otherwise it would get written back to Postgres as plaintext.
      const storedCredentials = encryptCredentialTokens(updatedCredentials);

      await pool.query(
        `UPDATE integrations SET credentials = $1 WHERE id = $2`,
        [JSON.stringify(storedCredentials), row.id]
      );

      console.log(`[token-refresh] Refreshed token for row ${row.id}, new expiry: ${newExpiresAt}`);
      refreshed++;
    } catch (err) {
      console.error(`[token-refresh] Unexpected error refreshing row ${row.id}:`, err);
      failed++;
    }
  }

  console.log(`[token-refresh] Done. Refreshed: ${refreshed}, Failed: ${failed}`);
  return { checked: rows.length, refreshed, failed };
}

/**
 * Registers a daily cron job (runs at 3:00 AM server time) that checks
 * for and refreshes any tokens nearing expiry.
 */
function startTokenRefreshScheduler() {
  cron.schedule('0 3 * * *', () => {
    refreshExpiringTokens().catch((err) =>
      console.error('[token-refresh] Scheduled run failed:', err)
    );
  });
  console.log('[token-refresh] Scheduler registered — runs daily at 3:00 AM.');
}

module.exports = { refreshExpiringTokens, startTokenRefreshScheduler };