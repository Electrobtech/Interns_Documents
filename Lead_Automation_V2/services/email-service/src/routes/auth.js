/**
 * src/routes/auth.js
 *
 * OAuth routes for connecting a Gmail mailbox. Same split as
 * review-service/src/google/routes.js: a `publicRouter` for the callback
 * (Google's redirect lands here directly from the browser, so it can't
 * carry our Authorization header) and an authenticated `router` for
 * everything else.
 *
 * Mounted in index.js as:
 *   app.use(authRoutes.publicRouter);   // before authenticate
 *   app.use('/email/auth', authRoutes.router); // after authenticate
 */

const express = require('express');
const { pool, sign, verify, requireRole, withTenantScope } = require('@lead/shared');
const oauthClient = require('./../services/oauthClient');
const { saveTokens } = require('../services/tokenStore');
const gmailApi = require('../services/gmailApi');
const { initialSync } = require('../services/syncService');
const { registerWatch } = require('../services/watchJob');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/** Keeps the `channels` list (Integrations > Channels tab) in sync with connected mailboxes. */
async function upsertEmailChannel(organizationId, displayName, status) {
  const { rows } = await pool.query(
    `SELECT id FROM channels WHERE organization_id=$1 AND type='email' AND display_name=$2`,
    [organizationId, displayName]
  );
  if (rows[0]) {
    await pool.query(`UPDATE channels SET status=$2 WHERE id=$1`, [rows[0].id, status]);
  } else {
    await pool.query(
      `INSERT INTO channels (organization_id, type, display_name, status) VALUES ($1,'email',$2,$3)`,
      [organizationId, displayName, status]
    );
  }
}

// ---------- Public (no Authorization header available) ----------

const publicRouter = express.Router();

publicRouter.get('/email/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const fail = (message) => res.redirect(`${FRONTEND_URL}/app/inbox?email_error=${encodeURIComponent(message)}`);

  if (error) return fail(String(error));
  if (!code || !state) return fail('Missing authorization code.');

  let claims;
  try {
    claims = verify(state);
  } catch {
    return fail('Invalid or expired login attempt. Please try connecting again.');
  }

  try {
    const tokenResponse = await oauthClient.exchangeCode(code);

    // Need the mailbox's own address before we can upsert a row — Gmail's
    // /profile endpoint (scoped by the access token we just received)
    // gives us that without needing the separate userinfo endpoint.
    const profile = await gmailApi.getProfile(tokenResponse.access_token);

    // This route runs before app.use(authenticate) (Google's redirect
    // can't carry our Authorization header), so nothing here is
    // tenant-scoped yet — every one of these tables is under RLS (see
    // infra/db/rls.sql), which fails a query closed (zero rows / silently
    // dropped write) without app.current_org set. withTenantScope pins the
    // organizationId we recovered from the signed `state` param for the
    // rest of this handler, same as shared/src/auth.js's authenticate
    // middleware does for every normal authenticated request.
    const accountId = await withTenantScope(claims.organizationId, async () => {
      const { rows } = await pool.query(
        `INSERT INTO email_accounts (organization_id, provider, email, connected_by, connected)
         VALUES ($1,'gmail',$2,$3,true)
         ON CONFLICT (organization_id, email) DO UPDATE SET connected=true, updated_at=now()
         RETURNING id`,
        [claims.organizationId, profile.emailAddress, claims.userId || null]
      );
      const id = rows[0].id;
      await saveTokens(id, tokenResponse);
      await upsertEmailChannel(claims.organizationId, profile.emailAddress, 'connected');
      return id;
    });

    // Kick off the first sync inline — small (25 message) initial batch,
    // so the mailbox isn't empty the moment the user lands back on the
    // inbox. Failure here doesn't undo the connection; it just means the
    // next poll pass (or a manual POST /email/accounts/:id/sync) fills it
    // in. Both are background work that outlives this request, so each
    // gets its own withTenantScope rather than inheriting the block above.
    withTenantScope(claims.organizationId, () => initialSync(accountId)).catch((err) =>
      console.error(`[email-auth] Initial sync failed for ${profile.emailAddress}:`, err.message)
    );
    withTenantScope(claims.organizationId, () => registerWatch(accountId)).catch((err) =>
      console.warn(`[email-auth] Watch registration failed for ${profile.emailAddress} (will rely on polling):`, err.message)
    );

    return res.redirect(`${FRONTEND_URL}/app/inbox?email=connected`);
  } catch (err) {
    console.error('[email-auth] Callback failed:', err);
    return fail(err.message || 'Failed to connect this Gmail mailbox.');
  }
});

// ---------- Authenticated ----------

const router = express.Router();

/**
 * GET /email/auth/connect-url
 * Returns the Google consent URL as JSON, tied to the caller's
 * organization + user via a signed state param.
 */
router.get('/connect-url', (req, res) => {
  try {
    const state = sign({ organizationId: req.user.organizationId, userId: req.user.userId, purpose: 'gmail_oauth' });
    res.json({ url: oauthClient.buildAuthUrl(state) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /email/auth/:id/disconnect  (admin only)
 * Revokes the token with Google, stops the Pub/Sub watch if any, and
 * marks the row disconnected (kept, not deleted, so message history stays
 * visible in the inbox).
 */
router.post('/:id/disconnect', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM email_accounts WHERE id=$1 AND organization_id=$2`,
      [req.params.id, req.user.organizationId]
    );
    const account = rows[0];
    if (!account) return res.status(404).json({ error: 'Email account not found.' });

    try {
      const { getValidAccessToken } = require('../services/tokenStore');
      const accessToken = await getValidAccessToken(account.id);
      await gmailApi.stopWatch(accessToken).catch(() => {});
      await oauthClient.revokeToken(accessToken);
    } catch (e) {
      console.warn('[email-auth] Could not cleanly revoke on disconnect (continuing):', e.message);
    }

    await pool.query(
      `UPDATE email_accounts SET connected=false, access_token=NULL, refresh_token=NULL, updated_at=now() WHERE id=$1`,
      [account.id]
    );
    await upsertEmailChannel(req.user.organizationId, account.email, 'disconnected');

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { publicRouter, router };
