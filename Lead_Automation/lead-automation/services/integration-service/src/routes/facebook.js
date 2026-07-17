/**
 * src/routes/facebook.js
 *
 * Publishing + reading routes for Facebook Pages, using the Page access
 * token saved earlier during OAuth (see routes/auth.js). Reuses the same
 * `integrations` row (provider: 'instagram') since both Page and IG
 * credentials come from the same Facebook Login flow.
 *
 * Mounted in index.js AFTER app.use(authenticate), so req.user.organizationId
 * is always available here — that's what scopes every lookup to the
 * calling organization's own connection.
 */

const express = require('express');
const router = express.Router();
const { GRAPH_URL, withAuth, getAppSecretProof, validateToken } = require('../services/graphApi');
const { mapMetaError } = require('../services/errorMapper');
const { getConnectedCredentials } = require('../services/credentials');
const metaService = require('../services/metaService');

/**
 * POST /facebook/publish
 * Body: { "message": "some text" }
 * Posts a text post to the Page's feed.
 */
router.post('/publish', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const { page_id, page_access_token } = creds;

    if (!page_id || !page_access_token) {
      return res.status(400).json({ error: 'Missing Page credentials in saved integration.' });
    }

    // Pre-check: confirm the token is still valid before spending a
    // publish attempt on it — gives a clear "please reconnect" message
    // instead of a confusing Graph API error if the token was revoked.
    const validation = await validateToken(page_access_token);
    if (!validation.valid) {
      console.warn('Facebook token failed validation before publish:', validation.raw);
      return res.status(401).json({
        error: 'Facebook connection is no longer valid. Please reconnect via /auth/connect-url.',
      });
    }

    const postRes = await fetch(`${GRAPH_URL}/${page_id}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: withAuth({ message }, page_access_token),
    });
    const postData = await postRes.json();

    if (postData.error) {
      console.error('Facebook post failed:', postData.error);
      const mapped = mapMetaError(postData.error);
      return res.status(mapped.httpStatus).json(mapped);
    }

    console.log('FACEBOOK POST ID:', postData.id);
    res.json({ success: true, postId: postData.id });
  } catch (err) {
    console.error('Facebook publish route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /facebook/publish-photo
 * Body: { "imageUrl": "https://...", "caption": "optional text" }
 * Posts a photo to the Page's feed.
 */
router.post('/publish-photo', async (req, res) => {
  const { imageUrl, caption } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl is required' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const { page_id, page_access_token } = creds;

    if (!page_id || !page_access_token) {
      return res.status(400).json({ error: 'Missing Page credentials in saved integration.' });
    }

    // Pre-check: confirm the token is still valid before spending a
    // publish attempt on it.
    const validation = await validateToken(page_access_token);
    if (!validation.valid) {
      console.warn('Facebook token failed validation before photo publish:', validation.raw);
      return res.status(401).json({
        error: 'Facebook connection is no longer valid. Please reconnect via /auth/connect-url.',
      });
    }

    const photoRes = await fetch(`${GRAPH_URL}/${page_id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: withAuth({ url: imageUrl, caption: caption || '' }, page_access_token),
    });
    const photoData = await photoRes.json();

    if (photoData.error) {
      console.error('Facebook photo post failed:', photoData.error);
      const mapped = mapMetaError(photoData.error);
      return res.status(mapped.httpStatus).json(mapped);
    }

    console.log('FACEBOOK PHOTO POST ID:', photoData.id, 'POST ID:', photoData.post_id);
    res.json({ success: true, photoId: photoData.id, postId: photoData.post_id });
  } catch (err) {
    console.error('Facebook photo publish route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /facebook/publish-video
 * Body: { "videoUrl": "https://...", "description": "optional caption/description" }
 * Posts a video to the Page's feed. Meta processes the video asynchronously
 * after upload, but /{page_id}/videos (unlike IG's container flow) accepts
 * the post as complete immediately — no separate publish step needed.
 */
router.post('/publish-video', async (req, res) => {
  const { videoUrl, description } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl is required' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const { page_id, page_access_token } = creds;

    if (!page_id || !page_access_token) {
      return res.status(400).json({ error: 'Missing Page credentials in saved integration.' });
    }

    const validation = await validateToken(page_access_token);
    if (!validation.valid) {
      console.warn('Facebook token failed validation before video publish:', validation.raw);
      return res.status(401).json({
        error: 'Facebook connection is no longer valid. Please reconnect via /auth/connect-url.',
      });
    }

    const videoRes = await fetch(`${GRAPH_URL}/${page_id}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: withAuth({ file_url: videoUrl, description: description || '' }, page_access_token),
    });
    const videoData = await videoRes.json();

    if (videoData.error) {
      console.error('Facebook video post failed:', videoData.error);
      const mapped = mapMetaError(videoData.error);
      return res.status(mapped.httpStatus).json(mapped);
    }

    console.log('FACEBOOK VIDEO ID:', videoData.id);
    res.json({ success: true, videoId: videoData.id });
  } catch (err) {
    console.error('Facebook video publish route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /facebook/reply-comment
 * Body: { "commentId": "1234_5678", "message": "Thanks for your comment!" }
 * Replies to a comment on a Page post.
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
    console.error('Facebook reply-comment route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /facebook/send-message
 * Body: { "recipientId": "PSID...", "text": "Hi there!" }
 * Sends a Messenger DM reply. recipientId is the PSID from an inbound
 * message/webhook (see messageNormalizer.js).
 */
router.post('/send-message', async (req, res) => {
  const { recipientId, text } = req.body;

  if (!recipientId || !text) {
    return res.status(400).json({ error: 'recipientId and text are both required.' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const result = await metaService.sendPageMessage(creds, recipientId, text);
    res.json({ success: true, messageId: result.message_id, raw: result });
  } catch (err) {
    console.error('Facebook send-message route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /facebook/feed
 * Returns the Page's recent posts (sanity check that the token works).
 */
router.get('/feed', async (req, res) => {
  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const { page_id, page_access_token } = creds;

    // GET requests: appsecret_proof + access_token go in the query string.
    const proof = getAppSecretProof(page_access_token);
    const feedRes = await fetch(
      `${GRAPH_URL}/${page_id}/feed?fields=id,message,created_time&access_token=${page_access_token}&appsecret_proof=${proof}`
    );
    const feedData = await feedRes.json();

    if (feedData.error) {
      console.error('Fetching feed failed:', feedData.error);
      const mapped = mapMetaError(feedData.error);
      return res.status(mapped.httpStatus).json(mapped);
    }

    res.json(feedData);
  } catch (err) {
    console.error('Facebook feed route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /facebook/status
 * Checks whether the currently saved Page connection is still valid,
 * without publishing anything.
 */
router.get('/status', async (req, res) => {
  try {
    const creds = await getConnectedCredentials(req.user.organizationId);
    const validation = await validateToken(creds.page_access_token);

    res.json({
      connected: validation.valid,
      expiresAt: validation.expiresAt,
      scopes: validation.scopes,
      pageId: creds.page_id,
      pageName: creds.page_name,
    });
  } catch (err) {
    res.status(400).json({ connected: false, error: err.message });
  }
});

module.exports = router;