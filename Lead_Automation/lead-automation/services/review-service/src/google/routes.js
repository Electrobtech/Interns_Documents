const express = require('express');
const { pool, sign, verify } = require('@lead/shared');
const oauthClient = require('./oauthClient');
const tokenStore = require('./tokenStore');
const googleApi = require('./googleApi');
const store = require('./store');
const sync = require('./sync');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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
  const fail = (message) => res.redirect(`${FRONTEND_URL}/reviews?google_error=${encodeURIComponent(message)}`);

  if (error) return fail(String(error));
  if (!code || !state) return fail('Missing authorization code');

  let claims;
  try {
    claims = verify(state);
  } catch {
    return fail('Invalid or expired OAuth state');
  }

  try {
    const tokenResponse = await oauthClient.exchangeCode(code);
    await tokenStore.saveTokens(claims.organizationId, claims.userId, tokenResponse);
    await upsertGoogleChannel(claims.organizationId, 'connected');
    return res.redirect(`${FRONTEND_URL}/reviews?google=connected`);
  } catch (e) {
    return fail(e.message || 'Failed to connect Google Business Profile');
  }
});

// ---------- Authenticated ----------

const router = express.Router();

router.get('/google/login', (req, res) => {
  const state = sign({ organizationId: req.user.organizationId, userId: req.user.userId, purpose: 'google_oauth' });
  res.json({ url: oauthClient.buildAuthUrl(state) });
});

router.get('/google/status', async (req, res, next) => {
  try {
    const token = await tokenStore.getTokenRow(req.user.organizationId);
    const locations = await store.listLocations(req.user.organizationId);
    res.json({
      connected: !!token,
      scope: token?.scope || null,
      lastSyncAt: token?.last_sync_at || null,
      lastSyncStatus: token?.last_sync_status || null,
      lastSyncError: token?.last_sync_error || null,
      locationsCount: locations.length,
      selectedLocationId: locations.find((l) => l.isSelected)?.locationId || null,
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
    const accountId = await store.getAccountForLocation(req.user.organizationId, locationId);
    if (!locationId || !accountId) return res.status(404).json({ error: 'Review or location not found' });

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
    const accountId = await store.getAccountForLocation(req.user.organizationId, review.location_id);

    const accessToken = await tokenStore.getValidAccessToken(req.user.organizationId);
    await googleApi.deleteReply(accessToken, accountId, review.location_id, reviewId);
    const updated = await store.setReply(req.user.organizationId, reviewId, null, null);
    res.json(updated);
  } catch (e) { next(e); }
});

router.post('/google/sync', async (req, res, next) => {
  try {
    const summary = await sync.syncOrganization(req.user.organizationId, { locationId: req.body?.locationId });
    res.json(summary);
  } catch (e) { next(e); }
});

module.exports = { publicRouter, router };
