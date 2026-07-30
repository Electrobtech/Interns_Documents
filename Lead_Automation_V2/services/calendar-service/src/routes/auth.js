/**
 * src/routes/auth.js
 *
 * OAuth routes for connecting an organization's Google Calendar. Same
 * split as email-service/src/routes/auth.js: a `publicRouter` for the
 * callback (Google's redirect lands here directly from the browser, so it
 * can't carry our Authorization header) and an authenticated `router` for
 * everything else.
 *
 * Mounted in index.js as:
 *   app.use(authRoutes.publicRouter);              // before authenticate
 *   app.use('/calendar/auth', authRoutes.router);   // after authenticate
 */

const express = require('express');
const { pool, sign, verify } = require('@lead/shared');
const oauthClient = require('../services/oauthClient');
const tokenStore = require('../services/tokenStore');
const calendarApi = require('../services/calendarApi');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ---------- Public (no Authorization header available) ----------

const publicRouter = express.Router();

publicRouter.get('/calendar/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const fail = (message) => res.redirect(`${FRONTEND_URL}/app/settings/integrations?calendar_error=${encodeURIComponent(message)}`);

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
    const userInfo = await calendarApi.getUserInfo(tokenResponse.access_token).catch(() => ({}));
    await tokenStore.saveTokens(claims.organizationId, claims.userId || null, tokenResponse, { email: userInfo.email });
    return res.redirect(`${FRONTEND_URL}/app/settings/integrations?calendar=connected`);
  } catch (err) {
    console.error('[calendar-auth] Callback failed:', err);
    return fail(err.message || 'Failed to connect Google Calendar.');
  }
});

// ---------- Authenticated ----------

const router = express.Router();

/**
 * GET /calendar/auth/connect-url
 * Returns the Google consent URL as JSON, tied to the caller's
 * organization + user via a signed state param.
 */
router.get('/connect-url', (req, res) => {
  try {
    const state = sign({ organizationId: req.user.organizationId, userId: req.user.userId, purpose: 'calendar_oauth' });
    res.json({ url: oauthClient.buildAuthUrl(state) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /calendar/auth/status — powers the Integrations tab's connect card. */
router.get('/status', async (req, res) => {
  try {
    const account = await tokenStore.getAccount(req.user.organizationId);
    res.json({
      connected: !!account?.connected,
      email: account?.google_email || null,
      lastError: account?.last_error || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /calendar/auth/disconnect */
router.post('/disconnect', async (req, res) => {
  try {
    const account = await tokenStore.getAccount(req.user.organizationId);
    if (account?.refresh_token) {
      const { decrypt } = require('../services/crypto');
      await oauthClient.revokeToken(decrypt(account.refresh_token)).catch(() => {});
    }
    await tokenStore.disconnect(req.user.organizationId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { publicRouter, router };
