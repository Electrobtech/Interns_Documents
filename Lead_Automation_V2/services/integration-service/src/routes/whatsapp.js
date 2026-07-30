/**
 * src/routes/whatsapp.js
 *
 * WhatsApp Cloud API connection + messaging routes.
 *
 * Unlike Facebook/Instagram (routes/auth.js), WhatsApp Cloud API setup here
 * does NOT use an OAuth redirect flow. You generate the credentials once in
 * Meta Business Manager (a WhatsApp Business Account, a Phone Number ID
 * under it, and a permanent System User access token scoped to
 * `whatsapp_business_messaging` + `whatsapp_business_management`), then
 * paste them in via POST /whatsapp/connect. This matches how many
 * WhatsApp Cloud API integrations are actually run in production —
 * there's no per-end-user login step the way there is for a personal
 * Facebook/Instagram account.
 *
 * Mounted in index.js AFTER app.use(authenticate), so req.user.organizationId
 * is always available here — that's what scopes every lookup to the
 * calling organization's own connection.
 */

const express = require('express');
const router = express.Router();
const { pool, requireRole } = require('@lead/shared');
const { validateToken } = require('../services/graphApi');
const { mapMetaError } = require('../services/errorMapper');
const { getConnectedCredentials, getConnectionLockState, lockConnection, unlockConnection, verifyUnlockPassword } = require('../services/credentials');
const { encryptCredentialTokens } = require('../services/crypto');
const whatsappService = require('../services/whatsappService');

const PROVIDER = 'whatsapp';

/**
 * POST /whatsapp/connect
 * Body: {
 *   "phoneNumberId": "1234567890",
 *   "wabaId": "9876543210",
 *   "accessToken": "EAAG...",         // permanent System User token
 *   "displayPhoneNumber": "+1 415 555 1234"   // optional, cosmetic only
 * }
 *
 * Validates the token against Meta's /debug_token endpoint before saving,
 * so a typo'd or already-revoked token is caught immediately instead of
 * surfacing as a confusing failure on the first send. Upserts: if this
 * organization already has a WhatsApp row, it's replaced rather than
 * duplicated.
 */
router.post('/connect', async (req, res) => {
  const { phoneNumberId, wabaId, accessToken, displayPhoneNumber } = req.body;

  if (!phoneNumberId || !wabaId || !accessToken) {
    return res.status(400).json({
      error: 'phoneNumberId, wabaId, and accessToken are all required.',
    });
  }

  try {
    const lockState = await getConnectionLockState(req.user.organizationId, PROVIDER);
    if (lockState.locked) {
      return res.status(403).json({
        error: 'This WhatsApp connection is locked and can no longer be edited. Contact your account admin if it needs to change.',
      });
    }

    const validation = await validateToken(accessToken);
    if (!validation.valid) {
      console.warn('WhatsApp token failed validation on connect:', validation.raw);
      return res.status(400).json({
        error: 'That access token is not valid. Double-check it was copied in full and has not expired or been revoked.',
      });
    }

    const credentials = {
      phone_number_id: phoneNumberId,
      whatsapp_business_account_id: wabaId,
      whatsapp_access_token: accessToken,
      display_phone_number: displayPhoneNumber || null,
      token_expires_at: validation.expiresAt,
    };
    const storedCredentials = encryptCredentialTokens(credentials);

    const { rows: existing } = await pool.query(
      `SELECT id FROM integrations WHERE organization_id = $1 AND provider = $2 ORDER BY created_at DESC LIMIT 1`,
      [req.user.organizationId, PROVIDER]
    );

    let row;
    if (existing.length > 0) {
      const { rows } = await pool.query(
        `UPDATE integrations SET status = 'connected', credentials = $1
         WHERE id = $2 RETURNING id, provider, status, created_at`,
        [JSON.stringify(storedCredentials), existing[0].id]
      );
      row = rows[0];
    } else {
      const { rows } = await pool.query(
        `INSERT INTO integrations (organization_id, provider, status, credentials)
         VALUES ($1, $2, 'connected', $3)
         RETURNING id, provider, status, created_at`,
        [req.user.organizationId, PROVIDER, JSON.stringify(storedCredentials)]
      );
      row = rows[0];
    }

    // The token just passed Meta's /debug_token check above — that's the
    // "verification" this integration needs, so lock it immediately rather
    // than waiting for a separate step. See services/credentials.js.
    await lockConnection(req.user.organizationId, PROVIDER, req.user.userId || null);

    console.log('SAVED WHATSAPP INTEGRATION ROW:', row, 'for organization:', req.user.organizationId, '(locked)');
    res.status(201).json({ ...row, locked: true });
  } catch (err) {
    console.error('WhatsApp connect route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /whatsapp/send
 * Body: { "to": "14155551234", "text": "Hello!" }
 * Sends a free-form text message. Only works inside the 24-hour customer
 * service window after the user last messaged you — otherwise use
 * /whatsapp/send-template.
 */
router.post('/send', async (req, res) => {
  const { to, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({ error: 'to and text are both required.' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId, PROVIDER);
    const result = await whatsappService.sendTextMessage(creds, to, text);
    res.json({ success: true, messageId: result.messages?.[0]?.id, raw: result });
  } catch (err) {
    console.error('WhatsApp send route error:', err);
    const mapped = mapMetaError(extractMetaError(err));
    res.status(mapped.httpStatus).json(mapped);
  }
});

/**
 * POST /whatsapp/send-media
 * Body: { "to": "14155551234", "mediaType": "image"|"video"|"document", "link": "https://...", "caption": "optional" }
 * Sends an image, video, or document by public link. Same 24-hour session
 * window rule as /whatsapp/send applies — use /whatsapp/send-template
 * (with a media header component) outside that window.
 */
router.post('/send-media', async (req, res) => {
  const { to, mediaType, link, caption } = req.body;

  if (!to || !mediaType || !link) {
    return res.status(400).json({ error: 'to, mediaType, and link are all required.' });
  }
  if (!['image', 'video', 'document'].includes(mediaType)) {
    return res.status(400).json({ error: 'mediaType must be image, video, or document.' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId, PROVIDER);
    const result = await whatsappService.sendMediaMessage(creds, to, mediaType, link, caption);
    res.json({ success: true, messageId: result.messages?.[0]?.id, raw: result });
  } catch (err) {
    console.error('WhatsApp send-media route error:', err);
    const mapped = mapMetaError(extractMetaError(err));
    res.status(mapped.httpStatus).json(mapped);
  }
});

/**
 * POST /whatsapp/send-template
 * Body: {
 *   "to": "14155551234",
 *   "templateName": "order_confirmation",
 *   "languageCode": "en_US",
 *   "components": [{ "type": "body", "parameters": [{ "type": "text", "text": "Jane" }] }]
 * }
 * Sends a pre-approved template message — required for the first message
 * to a user, or any message outside the 24-hour session window.
 */
router.post('/send-template', async (req, res) => {
  const { to, templateName, languageCode, components } = req.body;

  if (!to || !templateName) {
    return res.status(400).json({ error: 'to and templateName are both required.' });
  }

  try {
    const creds = await getConnectedCredentials(req.user.organizationId, PROVIDER);
    const result = await whatsappService.sendTemplateMessage(
      creds, to, templateName, languageCode || 'en_US', components || []
    );
    res.json({ success: true, messageId: result.messages?.[0]?.id, raw: result });
  } catch (err) {
    console.error('WhatsApp send-template route error:', err);
    const mapped = mapMetaError(extractMetaError(err));
    res.status(mapped.httpStatus).json(mapped);
  }
});

/**
 * GET /whatsapp/status
 * Checks whether the currently saved WhatsApp connection is still valid,
 * without sending anything, and returns the connected phone number's
 * display info.
 */
router.get('/status', async (req, res) => {
  try {
    const creds = await getConnectedCredentials(req.user.organizationId, PROVIDER);
    const validation = await validateToken(creds.whatsapp_access_token);
    const lockState = await getConnectionLockState(req.user.organizationId, PROVIDER);

    let profile = null;
    if (validation.valid) {
      try {
        profile = await whatsappService.getPhoneNumberProfile(creds);
      } catch (err) {
        console.warn('WhatsApp status: profile fetch failed:', err.message);
      }
    }

    res.json({
      connected: validation.valid,
      locked: lockState.locked,
      lockedAt: lockState.lockedAt,
      expiresAt: validation.expiresAt,
      scopes: validation.scopes,
      phoneNumberId: creds.phone_number_id,
      whatsappBusinessAccountId: creds.whatsapp_business_account_id,
      displayPhoneNumber: profile?.display_phone_number || creds.display_phone_number,
      verifiedName: profile?.verified_name,
      qualityRating: profile?.quality_rating,
    });
  } catch (err) {
    res.status(400).json({ connected: false, error: err.message });
  }
});

/**
 * POST /whatsapp/unlock  (admin only + password)
 * Lifts the lock set automatically on connect, so the org can reconnect
 * with different credentials. Use this deliberately — it's the one
 * documented way around the "clients can't break it themselves" guarantee.
 * Being an admin is necessary but not sufficient — the request must also
 * include the correct admin unlock password (see verifyUnlockPassword).
 */
router.post('/unlock', requireRole('admin'), async (req, res) => {
  if (!verifyUnlockPassword(req.body?.password)) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  try {
    const didUnlock = await unlockConnection(req.user.organizationId, PROVIDER);
    if (!didUnlock) {
      return res.status(404).json({ error: 'No WhatsApp connection found for this organization.' });
    }
    res.json({ ok: true, locked: false });
  } catch (err) {
    console.error('WhatsApp unlock route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /whatsapp/disconnect
 * Marks the saved connection as disconnected without deleting the row
 * (matches the pattern used by /auth/deauthorize for Facebook/Instagram).
 */
router.post('/disconnect', async (req, res) => {
  try {
    const lockState = await getConnectionLockState(req.user.organizationId, PROVIDER);
    if (lockState.locked && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'This WhatsApp connection is locked. Contact your account admin to disconnect it.',
      });
    }
    await pool.query(
      `UPDATE integrations SET status = 'disconnected' WHERE organization_id = $1 AND provider = $2`,
      [req.user.organizationId, PROVIDER]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('WhatsApp disconnect route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * whatsappService throws plain Errors wrapping the raw Graph API error
 * JSON as text (see whatsappService.js) — pull the `.error` object back
 * out so mapMetaError can categorize it the same way routes/facebook.js
 * and routes/instagram.js do.
 */
function extractMetaError(err) {
  try {
    const parsed = JSON.parse(err.message.slice(err.message.indexOf('{')));
    return parsed.error || parsed;
  } catch {
    return { message: err.message };
  }
}

module.exports = router;