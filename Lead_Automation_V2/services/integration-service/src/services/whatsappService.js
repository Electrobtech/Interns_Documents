/**
 * src/services/whatsappService.js
 *
 * Handles direct communication with the WhatsApp Cloud API
 * (graph.facebook.com, same Graph API family as metaService.js, but a
 * different product with its own payload shape and its own access token).
 *
 * IMPORTANT: WhatsApp Cloud API credentials are NOT the Page access token
 * used by routes/facebook.js / routes/instagram.js. They come from a
 * WhatsApp Business Account (WABA) — typically a permanent "System User"
 * token generated in Meta Business Manager, plus the Phone Number ID you
 * want to send from. See routes/whatsapp.js for how these are saved.
 *
 * MULTI-TENANCY: like metaService.js, these functions take `credentials`
 * as a parameter rather than looking them up internally, so the caller
 * (routes/whatsapp.js for outbound sends, webhookWorker.js for inbound
 * auto-replies) is responsible for resolving the right organization's
 * credentials first.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

const { GRAPH_URL, getAppSecretProof } = require('./graphApi');

// Meta rate-limits per phone number / per app; a burst of sends (e.g. a
// campaign loop, or several webhook replies firing close together) can hit
// this under normal use, not just abuse. These are the codes worth
// retrying — everything else (bad recipient, invalid params, expired
// token) is permanent and retrying just wastes attempts and delays the
// real error reaching the caller.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  4,      // "Application request limit reached"
  80007,  // WhatsApp Business Account rate limit
  130429, // "Rate limit hit" (Cloud API specific)
  131048, // "Spam rate limit hit"
]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Low-level POST helper. WhatsApp Cloud API takes JSON bodies (unlike the
 * form-encoded bodies used elsewhere in this service for the Page Graph
 * API), and auth is a Bearer header rather than an access_token param.
 * appsecret_proof is still appended as a query param — same rationale as
 * graphApi.withAuth: proves the call originates from a server holding the
 * App Secret, not just anyone holding a leaked token.
 *
 * Retries transient failures (rate limits, 5xx) with backoff honoring the
 * API's own Retry-After header when present, otherwise exponential
 * (1s, 2s, 4s) with jitter so concurrent sends retrying at the same
 * instant don't all collide again. Permanent failures (bad params,
 * template not found) are surfaced immediately via the `ok`/`data` return
 * — callers already check `data.error`, so those still work unchanged.
 */
async function graphPost(path, payload, accessToken) {
  const proof = getAppSecretProof(accessToken);
  const url = `${GRAPH_URL}/${path}?appsecret_proof=${proof}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (resp.ok) return { ok: true, data };

    const errorCode = data?.error?.code;
    const retryable = RETRYABLE_STATUS.has(resp.status) || RETRYABLE_ERROR_CODES.has(errorCode);
    if (!retryable || attempt === MAX_ATTEMPTS) {
      return { ok: false, data };
    }

    console.warn(`[whatsappService] retryable error (attempt ${attempt}/${MAX_ATTEMPTS}):`, data?.error || data);
    const retryAfterHeader = Number(resp.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 250;
    await sleep(delay);
  }
}

/**
 * Send a plain text message.
 * `to` must be a full international-format phone number, no leading '+'
 * or punctuation (e.g. "14155551234") — this is how WhatsApp identifies
 * recipients, and how inbound `msg.from` values look in webhook payloads.
 *
 * Note: outside of Meta's 24-hour customer service window, WhatsApp only
 * allows pre-approved template messages (see sendTemplateMessage below) —
 * a free-form text send outside that window will be rejected by the API
 * with an error, which the caller should surface rather than swallow.
 */
async function sendTextMessage(credentials, to, text) {
  const { phone_number_id, whatsapp_access_token } = credentials;

  const { ok, data } = await graphPost(
    `${phone_number_id}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    whatsapp_access_token
  );

  if (!ok || data.error) {
    throw new Error(`Failed to send WhatsApp message: ${JSON.stringify(data)}`);
  }

  return data; // { messaging_product, contacts: [...], messages: [{ id }] }
}

/**
 * Send a pre-approved template message — required for the first message
 * to a user, or any message sent outside the 24-hour session window.
 * `components` follows Meta's template component format (header/body/
 * button parameters), e.g.:
 *   [{ type: 'body', parameters: [{ type: 'text', text: 'Jane' }] }]
 */
async function sendTemplateMessage(credentials, to, templateName, languageCode = 'en_US', components = []) {
  const { phone_number_id, whatsapp_access_token } = credentials;

  const { ok, data } = await graphPost(
    `${phone_number_id}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length ? { components } : {}),
      },
    },
    whatsapp_access_token
  );

  if (!ok || data.error) {
    throw new Error(`Failed to send WhatsApp template message: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Send an image, video, or document by public link.
 * `mediaType` must be one of 'image' | 'video' | 'document'.
 * `caption` is ignored for documents unless `filename` is also supplied by
 * the caller as part of a future extension — kept simple here.
 *
 * Same 24-hour session window rule as sendTextMessage applies: outside that
 * window, only template messages (sendTemplateMessage, with a media header
 * component) are allowed.
 */
async function sendMediaMessage(credentials, to, mediaType, link, caption) {
  const { phone_number_id, whatsapp_access_token } = credentials;

  if (!['image', 'video', 'document'].includes(mediaType)) {
    throw new Error(`Unsupported WhatsApp media type: ${mediaType}. Use image, video, or document.`);
  }

  const { ok, data } = await graphPost(
    `${phone_number_id}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: mediaType,
      [mediaType]: { link, ...(caption ? { caption } : {}) },
    },
    whatsapp_access_token
  );

  if (!ok || data.error) {
    throw new Error(`Failed to send WhatsApp ${mediaType} message: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Fetch basic profile info for the connected phone number. Useful as a
 * quick sanity check that a saved token + phone_number_id are valid and
 * working, and to display a human-readable number/name in the UI.
 */
async function getPhoneNumberProfile(credentials) {
  const { phone_number_id, whatsapp_access_token } = credentials;
  const proof = getAppSecretProof(whatsapp_access_token);

  const resp = await fetch(
    `${GRAPH_URL}/${phone_number_id}?fields=display_phone_number,verified_name,quality_rating&access_token=${whatsapp_access_token}&appsecret_proof=${proof}`
  );
  const data = await resp.json();

  if (!resp.ok || data.error) {
    throw new Error(`Failed to fetch WhatsApp phone number profile: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Marks an inbound message as read (blue ticks). Optional, best-effort —
 * failures here shouldn't block the reply itself.
 */
async function markMessageRead(credentials, messageId) {
  const { phone_number_id, whatsapp_access_token } = credentials;
  return graphPost(
    `${phone_number_id}/messages`,
    { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
    whatsapp_access_token
  );
}

module.exports = {
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  getPhoneNumberProfile,
  markMessageRead,
};
