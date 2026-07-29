// services/automation-service/src/services/whatsappSender.js
//
// Outbound side of the WhatsApp channel: takes a template already shaped by
// webhookController.buildSendTemplate() for channel: 'whatsapp' (text /
// interactive-button / interactive-list / document) and a recipient's phone
// number, and fires it at the WhatsApp Cloud API using the permanent token
// + phone number ID generated in the Meta Developer Portal.
//
// Uses global fetch (Node 18+) — same reasoning as instagramSender.js, no
// axios in this service's package.json.

const GRAPH_API_VERSION = 'v20.0';

// Meta rate-limits per phone number / per app; a burst of sends (e.g. a
// campaign broadcast loop) can hit this even under normal use, not just
// abuse. These are the codes worth retrying — everything else (bad
// recipient, template not found, expired token) is permanent and retrying
// just wastes the attempts and delays the real error reaching the caller.
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
 * POSTs to the Cloud API with retry-on-rate-limit/transient-error. Honors
 * the API's own Retry-After header when present, otherwise backs off
 * exponentially (1s, 2s, 4s) with a little jitter so a burst of sends
 * retrying at the same instant don't all collide again.
 */
async function postWithRetry(url, payload, accessToken) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      lastErr = new Error(`[whatsappSender] network error calling Cloud API: ${networkErr.message}`);
      if (attempt === MAX_ATTEMPTS) throw lastErr;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 250);
      continue;
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;

    const errorCode = data?.error?.code;
    const retryable = RETRYABLE_STATUS.has(response.status) || RETRYABLE_ERROR_CODES.has(errorCode);
    const apiError = data?.error?.message || `HTTP ${response.status}`;
    console.error(`[whatsappSender] Cloud API rejected message (attempt ${attempt}/${MAX_ATTEMPTS}):`, data?.error || data);

    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`[whatsappSender] send failed: ${apiError}`);
    }

    const retryAfterHeader = Number(response.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 250;
    await sleep(delay);
  }
  throw lastErr;
}

/**
 * Sends a message to a WhatsApp user via the Cloud API.
 *
 * @param {string} phoneNumber - the recipient's WhatsApp number in the
 *   Cloud API's expected format (E.164 digits, no leading +, e.g. "919000000000").
 *   This is the same value stored as `contactExternalId` on the
 *   ConversationSession for channel: 'whatsapp'.
 * @param {Object|string} template - a buildSendTemplate()-shaped object
 *   (e.g. { type: 'text', text: { body } } or { type: 'interactive', interactive: {...} }),
 *   or a plain string for a quick text send.
 * @returns {Promise<Object>} the parsed Graph API response body.
 * @throws {Error} if credentials are missing or the API call fails.
 */
async function sendWhatsAppMessage(phoneNumber, template) {
  const accessToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error('WHATSAPP_CLOUD_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID is not set — cannot send WhatsApp messages.');
  }
  if (!phoneNumber) {
    throw new Error('sendWhatsAppMessage requires a phoneNumber.');
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    ...normalizeTemplate(template),
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  return postWithRetry(url, payload, accessToken);
}

/**
 * Converts a buildSendTemplate() result (or a plain string) into the
 * `{ type, ... }` shape the Cloud API's /messages endpoint expects.
 * buildSendTemplate() already produces WhatsApp-native shapes 1:1 for
 * 'text' / 'interactive' / 'document' — so past the string convenience
 * case, this is a pass-through rather than a reconstruction, to avoid
 * silently diverging from whatever shape that function evolves into.
 */
function normalizeTemplate(template) {
  if (typeof template === 'string') {
    return { type: 'text', text: { body: template } };
  }
  if (!template || template.type === 'handoff') {
    // Handoff nodes have no outbound message of their own — the CRM side
    // (not this sender) is responsible for routing the conversation to a
    // human agent. Nothing to send to the customer here.
    return { type: 'text', text: { body: '' } };
  }
  if (template.type === 'document' && template.caption) {
    // buildSendTemplate() puts `caption` as a sibling of `document`, but the
    // Cloud API only reads it nested inside the document object itself.
    const { caption, ...rest } = template;
    return { ...rest, document: { ...rest.document, caption } };
  }
  return template;
}

module.exports = { sendWhatsAppMessage };
