/**
 * src/controllers/webhookController.js
 *
 * Handles Meta's webhook system for Instagram/Facebook/WhatsApp:
 *   - GET  /webhook/meta  -> one-time verification handshake
 *   - POST /webhook/meta  -> incoming events (messages, comments, etc.)
 *
 * MULTI-TENANCY: an incoming webhook event identifies the account only via
 * Meta's own Page ID / Instagram Business Account ID (entry.id in the
 * payload) — there's no JWT or organizationId on an inbound webhook call.
 * So for each event, we first resolve which organization's connection it
 * belongs to via credentials.getCredentialsByMetaId(), then use that
 * organization's saved Page token to send the reply.
 *
 * Env vars needed:
 *   META_WEBHOOK_VERIFY_TOKEN   - string you chose, entered in the
 *                                 Meta App Dashboard's Webhooks setup
 *   META_APP_SECRET             - used to verify the request signature
 */

const crypto = require('crypto');
const { enqueueWebhookEvent } = require('../services/webhookQueue');

const { META_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET } = process.env;

/**
 * GET /webhook/meta
 * Meta calls this once when you register/save the webhook URL.
 */
function verify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === META_WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified successfully.');
    return res.status(200).send(challenge);
  }

  console.warn('Webhook verification failed. Check your verify token.');
  return res.sendStatus(403);
}

/**
 * POST /webhook/meta
 * Acknowledge immediately (Meta retries on timeout/non-200), validate the
 * signature, then enqueue each entry for async processing and return.
 * The actual normalize -> lookup credentials -> send-reply work happens in
 * services/webhookWorker.js, off the request/response cycle entirely, with
 * BullMQ retry on failure.
 */
async function receiveEvent(req, res) {
  res.sendStatus(200);

  if (!isValidSignature(req)) {
    console.warn('Webhook signature verification failed — dropping payload.');
    return;
  }

  const body = req.body;

  if (body.object !== 'page' && body.object !== 'instagram' && body.object !== 'whatsapp_business_account') {
    return;
  }

  try {
    for (const entry of body.entry || []) {
      // entry.id is the Page ID (or IG Business Account ID, depending on
      // object type) that this event belongs to — resolved to an
      // organization's credentials later, inside the worker.
      await enqueueWebhookEvent(entry, body.object);
    }
  } catch (err) {
    console.error('Error enqueueing webhook event:', err);
  }
}

/**
 * Verify the X-Hub-Signature-256 header using the App Secret.
 * Requires req.rawBody (captured in routes/webhook.js) to compute correctly.
 * Uses a timing-safe comparison to avoid leaking info via response-time
 * differences (a standard precaution for signature checks).
 */
function isValidSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', META_APP_SECRET).update(req.rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

module.exports = {
  verify,
  receiveEvent,
};