const express = require('express');
const { pool, sign, verify } = require('@lead/shared');
const oauthClient = require('./oauthClient');
const tokenStore = require('./tokenStore');
const googleApi = require('./googleApi');
const store = require('./store');
const sync = require('./sync');
const configStore = require('./configStore');

// A real Google OAuth web-app client ID always ends with this suffix —
// cheap sanity check to catch obvious typos/pastes before we store anything.
const CLIENT_ID_PATTERN = /\.apps\.googleusercontent\.com$/;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Google Business Profile API access is temporarily unavailable, so the
// selected location may be a mock one seeded straight into google_reviews
// (see infra/db/seed.sql / migrations/033_mock_google_reviews.sql) rather
// than synced from a real connected account. Mock location/account ids are
// prefixed "mock-" by convention. Routes below check this to read/reply
// against the DB directly instead of calling the real Google API — nothing
// else about the request/response shape changes, so swapping back to the
// real integration later needs no frontend or schema changes.
const isMockLocation = (locationId) =>
  typeof locationId === 'string' && locationId.startsWith('locations/mock-');

// Keeps the `channels` list (Integrations > Channels tab) in sync with the
// Google connection, so Google Reviews shows up there too instead of only
// inside its own panel.
async function upsertGoogleChannel(organizationId, status) {
  const { rows } = await pool.query(
    `SELECT id FROM channels WHERE organization_id=$1 AND type='google_reviews'`,
    [organizationId]
  );
  if (rows[0]) {
    await pool.query(`UPDATE channels SET status=$2 WHERE id=$1`, [rows[0].id, status]);
  } else {
    await pool.query(
      `INSERT INTO channels (organization_id, type, display_name, status) VALUES ($1,'google_reviews','Google Business Profile',$2)`,
      [organizationId, status]
    );
  }
}

// ---------- Public (no Authorization header available) ----------

const publicRouter = express.Router();

publicRouter.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const fail = (message) => res.redirect(`${FRONTEND_URL}/app/reviews?google_error=${encodeURIComponent(message)}`);

  if (error) return fail(String(error));
  if (!code || !state) return fail('Missing authorization code');

  let claims;
  try {
    claims = verify(state);
  } catch {
    return fail('Invalid or expired OAuth state');
  }

  try {
    const creds = await configStore.resolveCredentials(claims.organizationId);
    if (!creds) return fail('Google OAuth is not configured for this organization');
    const tokenResponse = await oauthClient.exchangeCode(code, creds);
    await tokenStore.saveTokens(claims.organizationId, claims.userId, tokenResponse);
    await upsertGoogleChannel(claims.organizationId, 'connected');
    return res.redirect(`${FRONTEND_URL}/app/reviews?google=connected`);
  } catch (e) {
    return fail(e.message || 'Failed to connect Google Business Profile');
  }
});

// ---------- Authenticated ----------

const router = express.Router();

// ---------- Per-tenant OAuth client configuration ----------
// Lets each organization use its own Google Cloud OAuth client instead of
// the single global GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET pair. The
// secret is encrypted at rest (see ./configStore.js) and is never echoed
// back in any response.

router.post('/google/config', async (req, res, next) => {
  try {
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
    const clientSecret = typeof req.body?.clientSecret === 'string' ? req.body.clientSecret.trim() : '';

    if (!clientId) return res.status(400).json({ error: 'clientId is required' });
    if (!clientSecret) return res.status(400).json({ error: 'clientSecret is required' });
    if (!CLIENT_ID_PATTERN.test(clientId)) {
      return res.status(400).json({ error: 'clientId does not look like a valid Google OAuth client ID (should end with .apps.googleusercontent.com)' });
    }

    const saved = await configStore.saveConfig(req.user.organizationId, clientId, clientSecret);
    // Client secret is intentionally never included in the response.
    res.json({ configured: true, clientId: saved.clientId, updatedAt: saved.updatedAt });
  } catch (e) { next(e); }
});

router.get('/google/config', async (req, res, next) => {
  try {
    const config = await configStore.getConfig(req.user.organizationId);
    res.json({
      configured: !!config,
      clientId: config?.clientId || null,
      updatedAt: config?.updatedAt || null,
    });
  } catch (e) { next(e); }
});

router.get('/google/login', async (req, res, next) => {
  try {
    const creds = await configStore.resolveCredentials(req.user.organizationId);
    if (!creds) {
      return res.status(400).json({ error: 'Google OAuth is not configured for this organization. Save a Client ID and Client Secret first.' });
    }
    const state = sign({ organizationId: req.user.organizationId, userId: req.user.userId, purpose: 'google_oauth' });
    res.json({ url: oauthClient.buildAuthUrl(state, creds) });
  } catch (e) { next(e); }
});

router.get('/google/status', async (req, res, next) => {
  try {
    const token = await tokenStore.getTokenRow(req.user.organizationId);
    const locations = await store.listLocations(req.user.organizationId);
    const selected = locations.find((l) => l.isSelected);
    // No real token, but the selected location is the seeded mock one —
    // report "connected" anyway so the existing reviews UI renders without
    // requiring an actual Google OAuth connection. See isMockLocation above.
    const mock = !token && !!selected && isMockLocation(selected.locationId);
    res.json({
      connected: !!token || mock,
      mock,
      scope: token?.scope || null,
      lastSyncAt: token?.last_sync_at || null,
      lastSyncStatus: token?.last_sync_status || null,
      lastSyncError: token?.last_sync_error || null,
      locationsCount: locations.length,
      selectedLocationId: selected?.locationId || null,
    });
  } catch (e) { next(e); }
});

async function disconnectHandler(req, res, next) {
  try {
    await tokenStore.disconnect(req.user.organizationId);
    await upsertGoogleChannel(req.user.organizationId, 'disconnected');
    res.json({ ok: true });
  } catch (e) { next(e); }
}
// Both verbs are supported: POST per the integration's connect/disconnect
// pair (mirrors /google/login), DELETE for REST-style resource semantics.
router.post('/google/disconnect', disconnectHandler);
router.delete('/google/disconnect', disconnectHandler);

router.get('/google/accounts', async (req, res, next) => {
  try {
    const accessToken = await tokenStore.getValidAccessToken(req.user.organizationId);
    const accounts = await googleApi.listAccounts(accessToken);
    await store.upsertAccounts(req.user.organizationId, accounts);
    res.json(accounts);
  } catch (e) { next(e); }
});

router.get('/google/locations', async (req, res, next) => {
  try {
    const { accountId } = req.query;
    if (accountId) {
      const accessToken = await tokenStore.getValidAccessToken(req.user.organizationId);
      const locations = await googleApi.listLocations(accessToken, accountId);
      await store.upsertLocations(req.user.organizationId, accountId, locations);
    }
    res.json(await store.listLocations(req.user.organizationId, accountId));
  } catch (e) { next(e); }
});

router.put('/google/locations/:locationId/select', async (req, res, next) => {
  try {
    const locationId = decodeURIComponent(req.params.locationId);
    const row = await store.selectLocation(req.user.organizationId, locationId);
    res.json(row);
  } catch (e) { next(e); }
});

router.get('/google/reviews', async (req, res, next) => {
  try {
    const { locationId, rating, replied, search, sort, page, limit } = req.query;
    const result = await store.listReviews(req.user.organizationId, { locationId, rating, replied, search, sort, page, limit });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/google/reviews/:locationId', async (req, res, next) => {
  try {
    const locationId = decodeURIComponent(req.params.locationId);
    const { rating, replied, search, sort, page, limit } = req.query;
    const result = await store.listReviews(req.user.organizationId, { locationId, rating, replied, search, sort, page, limit });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/google/statistics', async (req, res, next) => {
  try {
    res.json(await store.getStatistics(req.user.organizationId, req.query.locationId));
  } catch (e) { next(e); }
});

router.post('/google/reply', async (req, res, next) => {
  try {
    const { reviewId, comment, locationId: bodyLocationId } = req.body || {};
    if (!reviewId || !comment) {
      return res.status(400).json({ error: 'reviewId and comment are required' });
    }
    const review = await store.getReview(req.user.organizationId, reviewId);
    const locationId = review?.location_id || bodyLocationId;
    if (!locationId) return res.status(404).json({ error: 'Review or location not found' });

    // Mock reviews (Google API unavailable) — save the reply straight to
    // the DB. This also doubles as "edit reply": posting again with a new
    // comment overwrites the previous one, same as the real Google flow.
    if (isMockLocation(locationId)) {
      const updated = await store.setReply(req.user.organizationId, reviewId, comment, new Date().toISOString());
      return res.json(updated);
    }

    const accountId = await store.getAccountForLocation(req.user.organizationId, locationId);
    if (!accountId) return res.status(404).json({ error: 'Review or location not found' });

    const accessToken = await tokenStore.getValidAccessToken(req.user.organizationId);
    const reply = await googleApi.updateReply(accessToken, accountId, locationId, reviewId, comment);
    const updated = await store.setReply(req.user.organizationId, reviewId, reply.replyComment, reply.replyUpdateTime);
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/google/reply/:reviewId', async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const review = await store.getReview(req.user.organizationId, reviewId);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (isMockLocation(review.location_id)) {
      const updated = await store.setReply(req.user.organizationId, reviewId, null, null);
      return res.json(updated);
    }

    const accountId = await store.getAccountForLocation(req.user.organizationId, review.location_id);

    const accessToken = await tokenStore.getValidAccessToken(req.user.organizationId);
    await googleApi.deleteReply(accessToken, accountId, review.location_id, reviewId);
    const updated = await store.setReply(req.user.organizationId, reviewId, null, null);
    res.json(updated);
  } catch (e) { next(e); }
});

router.post('/google/sync', async (req, res, next) => {
  try {
    const locationId = req.body?.locationId;
    if (isMockLocation(locationId)) {
      // Nothing to sync — mock reviews are seeded directly into the DB,
      // not pulled from a real connected account.
      return res.status(400).json({ error: 'This is mock review data — there is no live Google connection to sync from.' });
    }
    const summary = await sync.syncOrganization(req.user.organizationId, { locationId });
    res.json(summary);
  } catch (e) { next(e); }
});

module.exports = { publicRouter, router };