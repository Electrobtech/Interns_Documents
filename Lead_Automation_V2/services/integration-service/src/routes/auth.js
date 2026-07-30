/**
 * src/routes/auth.js
 *
 * OAuth routes for Facebook Login for Business (used to authorize
 * access to the linked Instagram Business account).
 * Mount in index.js with: app.use('/auth', require('./routes/auth'))
 *
 * MULTI-TENANCY:
 * GET /auth/facebook is a top-level browser redirect — it can't carry an
 * Authorization header. So the real entry point for a logged-in user is
 * the PROTECTED route GET /auth/connect-url, which requires a valid JWT,
 * reads req.user.organizationId, and stashes it in Redis alongside the
 * CSRF state. The callback then reads organizationId back out of Redis,
 * so the saved connection lands under the correct organization.
 *
 * /auth/facebook itself is kept as a fallback for manual/local testing
 * without a JWT — it stores no organizationId in Redis, and the callback
 * falls back to a default org in that case (see FALLBACK_ORG_ID below).
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool, authenticate, requireRole, withTenantScope, withSystemAccess } = require('@lead/shared');
const { getRedisClient } = require('../services/redisClient');
const { getAppSecretProof, parseSignedRequest } = require('../services/graphApi');
const { refreshExpiringTokens } = require('../services/tokenRefreshJob');
const { encryptCredentialTokens } = require('../services/crypto');
const { getConnectionLockState, lockConnection, unlockConnection, verifyUnlockPassword } = require('../services/credentials');

// Only used when /auth/facebook is hit directly without going through the
// protected /auth/connect-url flow (e.g. manual testing via browser).
const FALLBACK_ORG_ID = '11111111-1111-1111-1111-111111111111';

const GRAPH_BASE = process.env.META_GRAPH_API_BASE || 'https://graph.facebook.com';
const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0';
const GRAPH_URL = `${GRAPH_BASE}/${GRAPH_VERSION}`;

const STATE_TTL_SECONDS = 600; // 10 minutes — plenty of time to complete login

const SCOPE = 'pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_engagement,pages_messaging,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,business_management';

/**
 * Shared logic for starting the OAuth flow: generates a state, stores it
 * (with optional organizationId) in Redis, and returns the Facebook
 * OAuth dialog URL.
 */
async function buildOAuthUrl(organizationId) {
  const state = crypto.randomBytes(24).toString('hex');
  const redis = await getRedisClient();
  await redis.set(
    `oauth_state:${state}`,
    JSON.stringify({ organizationId: organizationId || null }),
    { EX: STATE_TTL_SECONDS }
  );

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    scope: SCOPE,
    response_type: 'code',
    state,
  });

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`;
}

/**
 * GET /auth/connect-url  (PROTECTED — requires a valid JWT)
 * Returns the Facebook OAuth URL as JSON, tied to the caller's
 * organization. A frontend calls this with the user's JWT, then
 * redirects the browser to the returned url.
 */
router.get('/connect-url', authenticate, async (req, res) => {
  try {
    const lockState = await getConnectionLockState(req.user.organizationId, 'instagram');
    if (lockState.locked) {
      return res.status(403).json({
        error: 'This Instagram/Facebook connection is locked and can no longer be changed. Contact your account admin if it needs to be reconnected.',
      });
    }
    const url = await buildOAuthUrl(req.user.organizationId);
    res.json({ url });
  } catch (err) {
    console.error('Failed to build connect URL:', err);
    res.status(500).json({ error: 'Could not start login. Please try again.' });
  }
});

/**
 * GET /auth/facebook  (public fallback — no organization context)
 * Kept for manual/local testing. Prefer /auth/connect-url for real use.
 */
router.get('/facebook', async (req, res) => {
  try {
    const url = await buildOAuthUrl(null);
    res.redirect(url);
  } catch (err) {
    console.error('Failed to start OAuth flow:', err);
    res.status(500).send('Could not start login. Please try again.');
  }
});

router.get('/facebook/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error) return res.status(400).send(`Auth failed: ${error}`);

  if (!state) {
    return res.status(400).send('Missing state parameter — possible CSRF attempt.');
  }

  try {
    // Verify the state matches one we generated and haven't already consumed.
    const redis = await getRedisClient();
    const storedStateRaw = await redis.get(`oauth_state:${state}`);

    if (!storedStateRaw) {
      console.warn('Invalid or expired OAuth state received:', state);
      return res.status(400).send('Invalid or expired login attempt. Please try again from the start.');
    }

    // Single-use: delete immediately so this state can't be replayed.
    await redis.del(`oauth_state:${state}`);

    const { organizationId: storedOrgId } = JSON.parse(storedStateRaw);
    const organizationId = storedOrgId || FALLBACK_ORG_ID;

    // Defense in depth: /connect-url already refuses to start this flow for
    // a locked org, but the public /auth/facebook fallback route can reach
    // this same callback without going through that check, so re-check here
    // right before anything gets saved.
    const lockState = await getConnectionLockState(organizationId, 'instagram');
    if (lockState.locked) {
      return res.status(403).send('This Instagram/Facebook connection is locked and can no longer be changed. Contact your account admin.');
    }

    // Step A: exchange the auth code for a short-lived token
    const tokenRes = await fetch(`${GRAPH_URL}/oauth/access_token?` +
      new URLSearchParams({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: process.env.META_REDIRECT_URI,
        code,
      }));
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('Token exchange failed:', tokenData.error);
      return res.status(400).json(tokenData.error);
    }

    console.log('SHORT-LIVED TOKEN acquired');

    // Step B: exchange the short-lived token for a long-lived one (~60 days)
    const longLivedRes = await fetch(`${GRAPH_URL}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: tokenData.access_token,
      }));
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      console.error('Long-lived exchange failed:', longLivedData.error);
      return res.status(400).json(longLivedData.error);
    }

    console.log('LONG-LIVED TOKEN acquired, expires in (seconds):', longLivedData.expires_in);

    // Step C: get the Meta app-scoped user id — needed so /deauthorize and
    // /data-deletion (which only receive this id from Meta) can find the
    // right row later, instead of guessing or affecting every connection.
    const userProof = getAppSecretProof(longLivedData.access_token);
    const meRes = await fetch(
      `${GRAPH_URL}/me?fields=id&access_token=${longLivedData.access_token}&appsecret_proof=${userProof}`
    );
    const meData = await meRes.json();
    const metaUserId = meData.id || null;

    // Step D: fetch the Pages this user manages
    const pagesRes = await fetch(
      `${GRAPH_URL}/me/accounts?access_token=${longLivedData.access_token}&appsecret_proof=${userProof}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      console.error('Fetching pages failed:', pagesData.error);
      return res.status(400).json(pagesData.error);
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      return res.status(400).send('No Pages found for this user.');
    }

    // Use the first page (adjust later if managing multiple pages)
    const page = pagesData.data[0];
    console.log('PAGE ID:', page.id);

    // Step E: get the Instagram Business Account linked to this Page
    const pageProof = getAppSecretProof(page.access_token);
    const igRes = await fetch(
      `${GRAPH_URL}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}&appsecret_proof=${pageProof}`
    );
    const igData = await igRes.json();

    if (igData.error) {
      console.error('Fetching IG account failed:', igData.error);
      return res.status(400).json(igData.error);
    }

    const igBusinessAccountId = igData.instagram_business_account?.id || null;
    console.log('INSTAGRAM BUSINESS ACCOUNT:', igBusinessAccountId);

    // Step F: save everything to Postgres, scoped to the caller's organization
    const expiresInSeconds = longLivedData.expires_in || 5184000;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const credentials = {
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
      instagram_business_account_id: igBusinessAccountId,
      long_lived_user_token: longLivedData.access_token,
      token_expires_at: expiresAt,
      meta_user_id: metaUserId,
    };

    // Encrypt the two token fields at rest (AES-256-GCM, see services/crypto.js).
    // Everything else (page_id, page_name, ig account id, expiry, meta_user_id)
    // stays plaintext so it remains queryable/displayable without decrypting.
    const storedCredentials = encryptCredentialTokens(credentials);

    const { rows } = await withTenantScope(organizationId, () => pool.query(
      `INSERT INTO integrations (organization_id, provider, status, credentials)
       VALUES ($1, $2, $3, $4)
       RETURNING id, provider, status, created_at`,
      [organizationId, 'instagram', 'connected', JSON.stringify(storedCredentials)]
    ));

    console.log('SAVED INTEGRATION ROW:', rows[0], 'for organization:', organizationId);

    // The token exchange + Pages/IG lookup above only succeeds with a
    // genuinely valid Meta login, so that's this integration's verification
    // step — lock it immediately rather than waiting for a separate action.
    await lockConnection(organizationId, 'instagram', null);

    res.send(`Success! Instagram connected and saved. Integration ID: ${rows[0].id}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Something broke');
  }
});

/**
 * POST /auth/refresh-tokens
 * Manually triggers the token refresh check (normally runs daily via cron).
 * Useful for testing without waiting for the schedule.
 */
router.post('/refresh-tokens', async (req, res) => {
  try {
    const result = await refreshExpiringTokens();
    res.json(result);
  } catch (err) {
    console.error('Manual token refresh trigger failed:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/deauthorize
 * Meta calls this when a user removes your app from their Facebook
 * settings. We scope the update to the specific row whose stored
 * meta_user_id matches — not every connection — thanks to storing that
 * id at connect time (Step C above).
 *
 * Required for App Review: https://developers.facebook.com/docs/facebook-login/guides/advanced/existing-token#deauth-callback
 */
router.post('/deauthorize', async (req, res) => {
  const payload = parseSignedRequest(req.body.signed_request);

  if (!payload) {
    console.warn('Deauthorize callback: invalid signed_request, ignoring.');
    return res.sendStatus(400);
  }

  console.log('Deauthorize callback received for user_id:', payload.user_id);

  try {
    const result = await withSystemAccess(() => pool.query(
      `UPDATE integrations SET status = 'disconnected'
       WHERE provider = 'instagram' AND status = 'connected'
         AND credentials->>'meta_user_id' = $1`,
      [payload.user_id]
    ));
    console.log(`Marked ${result.rowCount} integration(s) as disconnected for meta_user_id ${payload.user_id}.`);
  } catch (err) {
    console.error('Failed to update integration status on deauthorize:', err);
  }

  res.sendStatus(200);
});

/**
 * POST /auth/data-deletion
 * Same meta_user_id scoping as /deauthorize above, so only the specific
 * user's connection is deleted — not every organization's data.
 *
 * Required for App Review: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
router.post('/data-deletion', async (req, res) => {
  const payload = parseSignedRequest(req.body.signed_request);

  if (!payload) {
    console.warn('Data deletion callback: invalid signed_request, ignoring.');
    return res.sendStatus(400);
  }

  const confirmationCode = crypto.randomBytes(8).toString('hex');
  console.log('Data deletion requested for user_id:', payload.user_id, 'confirmation:', confirmationCode);

  try {
    const result = await withSystemAccess(() => pool.query(
      `DELETE FROM integrations WHERE provider = 'instagram' AND credentials->>'meta_user_id' = $1`,
      [payload.user_id]
    ));
    console.log(`Deleted ${result.rowCount} integration(s) for meta_user_id ${payload.user_id}.`);
  } catch (err) {
    console.error('Failed to delete data on data-deletion callback:', err);
  }

  res.json({
    url: `${process.env.META_REDIRECT_URI.replace('/auth/facebook/callback', '')}/auth/data-deletion-status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
});

/**
 * GET /auth/data-deletion-status
 */
router.get('/data-deletion-status', (req, res) => {
  const { code } = req.query;
  res.send(`Data deletion request ${code || ''} has been processed. All associated Instagram/Facebook connection data has been removed.`);
});

/**
 * POST /auth/unlock  (protected, admin only + password)
 * Lifts the lock set automatically after a verified Instagram/Facebook
 * connect, so the org can go through OAuth again with a different account.
 * Being an admin is necessary but not sufficient — the request must also
 * include the correct admin unlock password (see verifyUnlockPassword).
 */
router.post('/unlock', authenticate, requireRole('admin'), async (req, res) => {
  if (!verifyUnlockPassword(req.body?.password)) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  try {
    const didUnlock = await unlockConnection(req.user.organizationId, 'instagram');
    if (!didUnlock) {
      return res.status(404).json({ error: 'No Instagram/Facebook connection found for this organization.' });
    }
    res.json({ ok: true, locked: false });
  } catch (err) {
    console.error('Unlock route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;