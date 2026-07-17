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
const metaService = require('../services/metaService');

// Video containers process asynchronously on Meta's side — we poll
// /{container_id}?fields=status_code until it's FINISHED (or ERROR/EXPIRED)
// before attempting media_publish, since publishing too early just fails.
const VIDEO_POLL_INTERVAL_MS = 3000;
const VIDEO_POLL_TIMEOUT_MS = 120000; // 2 minutes — generous for short reels/videos

async function waitForContainerReady(containerId, accessToken) {
  const start = Date.now();
  while (Date.now() - start < VIDEO_POLL_TIMEOUT_MS) {
    const statusRes = await fetch(
      `${GRAPH_URL}/${containerId}?` + withAuth({ fields: 'status_code' }, accessToken)
    );
    const statusData = await statusRes.json();

    if (statusData.error) return { ok: false, error: statusData.error };
    if (statusData.status_code === 'FINISHED') return { ok: true };
    if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
      return { ok: false, error: { message: `Media processing ${statusData.status_code.toLowerCase()}.` } };
    }
    // IN_PROGRESS or PUBLISHED (already) — keep waiting / fall through to publish attempt.
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
  }
  return { ok: false, error: { message: 'Timed out waiting for video to finish processing.' } };
}

/**
 * POST /instagram/publish
 * Body (image):  { "imageUrl": "https://...", "caption": "some text" }
 * Body (video):  { "videoUrl": "https://...", "caption": "some text", "isReel": true }
 *
 * Exactly one of imageUrl / videoUrl is required. `isReel` (video only)
 * publishes as a Reel (media_type=REELS) instead of a regular feed video —
 * defaults to true since Meta increasingly treats feed video and Reels the
 * same way, but can be set to false for a plain feed video post.
 */
router.post('/publish', async (req, res) => {
  const { imageUrl, videoUrl, caption, isReel } = req.body;

  if (!imageUrl && !videoUrl) {
    return res.status(400).json({ error: 'Either imageUrl or videoUrl is required.' });
  }
  if (imageUrl && videoUrl) {
    return res.status(400).json({ error: 'Provide only one of imageUrl or videoUrl, not both.' });
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
    const containerParams = imageUrl
      ? { image_url: imageUrl, caption: caption || '' }
      : { video_url: videoUrl, caption: caption || '', media_type: isReel === false ? 'VIDEO' : 'REELS' };

    const containerRes = await fetch(`${GRAPH_URL}/${instagram_business_account_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: withAuth(containerParams, page_access_token),
    });
    const containerData = await containerRes.json();

    if (containerData.error) {
      console.error('Container creation failed:', containerData.error);
      const mapped = mapMetaError(containerData.error);
      return res.status(mapped.httpStatus).json(mapped);
    }

    console.log('MEDIA CONTAINER CREATED:', containerData.id);

    // Videos process asynchronously — wait for the container to finish
    // before publishing. Images are ready immediately, so skip the poll.
    if (videoUrl) {
      const ready = await waitForContainerReady(containerData.id, page_access_token);
      if (!ready.ok) {
        console.error('Video container failed to become ready:', ready.error);
        const mapped = mapMetaError(ready.error);
        return res.status(mapped.httpStatus).json(mapped);
      }
    }

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

    res.json({ success: true, mediaId: publishData.id, mediaType: videoUrl ? (isReel === false ? 'video' : 'reel') : 'image' });
  } catch (err) {
    console.error('Publish route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /instagram/reply-comment
 * Body: { "commentId": "1789...", "message": "Thanks for your comment!" }
 * Replies to a comment on an IG post/media/Reel.
 */
router.post('/reply-comment', async (req, res) => {
  const { commentId, message } = req.body;

  if (!commentId || !message) {
    return res.status(400).json({ error: 'commentId and message are both required.' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const result = await metaService.replyToComment(creds, commentId, message);
    res.json({ success: true, replyId: result.id, raw: result });
  } catch (err) {
    console.error('Instagram reply-comment route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /instagram/send-message
 * Body: { "recipientId": "179...", "text": "Hi there!" }
 * Sends a DM reply to an Instagram user (recipientId is the IG-scoped
 * sender id from an inbound message/webhook — see messageNormalizer.js).
 */
router.post('/send-message', async (req, res) => {
  const { recipientId, text } = req.body;

  if (!recipientId || !text) {
    return res.status(400).json({ error: 'recipientId and text are both required.' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const result = await metaService.sendMessage(creds, recipientId, text);
    res.json({ success: true, messageId: result.message_id, raw: result });
  } catch (err) {
    console.error('Instagram send-message route error:', err);
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