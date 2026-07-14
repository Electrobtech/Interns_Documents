/**
 * src/routes/instagram.js
 *
 * Publishing routes for Instagram, using the Page access token +
 * Instagram Business Account ID saved earlier during OAuth (see routes/auth.js).
 *
 * Mounted in index.js AFTER app.use(authenticate), so req.user.organizationId
 * is always available here — that's what scopes every lookup to the
 * calling organization's own connection.
 */

const express = require('express');
const router = express.Router();
const { GRAPH_URL, withAuth, validateToken } = require('../services/graphApi');
const { mapMetaError } = require('../services/errorMapper');
const { getConnectedCredentials } = require('../services/credentials');

/**
 * POST /instagram/publish
 * Body: { "imageUrl": "https://...", "caption": "some text" }
 */
router.post('/publish', async (req, res) => {
  const { imageUrl, caption } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl is required' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const { instagram_business_account_id, page_access_token } = creds;

    if (!instagram_business_account_id || !page_access_token) {
      return res.status(400).json({ error: 'Missing Instagram credentials in saved integration.' });
    }

    // Pre-check: confirm the token is still valid before spending a
    // publish attempt on it — gives a clear "please reconnect" message
    // instead of a confusing Graph API error if the token was revoked.
    const validation = await validateToken(page_access_token);
    if (!validation.valid) {
      console.warn('Instagram token failed validation before publish:', validation.raw);
      return res.status(401).json({
        error: 'Instagram connection is no longer valid. Please reconnect via /auth/connect-url.',
      });
    }

    // Step 1: create the media container
    // appsecret_proof (via withAuth) proves this request genuinely comes from
    // our server, since only we hold the App Secret needed to generate it.
    const containerRes = await fetch(`${GRAPH_URL}/${instagram_business_account_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: withAuth({ image_url: imageUrl, caption: caption || '' }, page_access_token),
    });
    const containerData = await containerRes.json();

    if (containerData.error) {
      console.error('Container creation failed:', containerData.error);
      const mapped = mapMetaError(containerData.error);
      return res.status(mapped.httpStatus).json(mapped);
    }

    console.log('MEDIA CONTAINER CREATED:', containerData.id);

    // Step 2: publish the container
    const publishRes = await fetch(`${GRAPH_URL}/${instagram_business_account_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: withAuth({ creation_id: containerData.id }, page_access_token),
    });
    const publishData = await publishRes.json();

    if (publishData.error) {
      console.error('Publish failed:', publishData.error);
      const mapped = mapMetaError(publishData.error);
      return res.status(mapped.httpStatus).json(mapped);
    }

    console.log('PUBLISHED MEDIA ID:', publishData.id);

    res.json({ success: true, mediaId: publishData.id });
  } catch (err) {
    console.error('Publish route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /instagram/status
 * Checks whether the currently saved Instagram connection is still valid,
 * without publishing anything. Useful for a "connected ✅ / reconnect ❌"
 * indicator in a dashboard.
 */
router.get('/status', async (req, res) => {
  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const validation = await validateToken(creds.page_access_token);

    res.json({
      connected: validation.valid,
      expiresAt: validation.expiresAt,
      scopes: validation.scopes,
      instagramBusinessAccountId: creds.instagram_business_account_id,
    });
  } catch (err) {
    res.status(400).json({ connected: false, error: err.message });
  }
});

module.exports = router;