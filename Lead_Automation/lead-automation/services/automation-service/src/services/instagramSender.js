// services/automation-service/src/services/instagramSender.js
//
// Outbound side of the Instagram channel: takes a template already shaped by
// webhookController.buildSendTemplate() and a recipient PSID, and fires it at
// the Instagram Graph API's /me/messages endpoint using the Page Access
// Token generated in the Meta Developer Portal (see docs/META_SANDBOX.md).
//
// Uses global fetch (Node 18+) rather than adding axios as a dependency —
// automation-service currently has no HTTP client in package.json.
 
const GRAPH_API_VERSION = 'v20.0';
 
/**
 * Sends a text or generic template message to an Instagram user via the
 * Page's Graph API messaging endpoint.
 *
 * @param {string} instagramSenderId - the recipient's Instagram-scoped ID (PSID),
 *   i.e. the same `contactExternalId` stored on the ConversationSession for
 *   channel: 'instagram'.
 * @param {string|Object} message - either a plain text string, or an already
 *   channel-shaped template object from buildSendTemplate() (e.g.
 *   { type: 'text', body } or { type: 'buttons', body, buttons }).
 * @returns {Promise<Object>} the parsed Graph API response body.
 * @throws {Error} if the access token is missing or the API call fails.
 */
async function sendInstagramMessage(instagramSenderId, message) {
  const accessToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('INSTAGRAM_PAGE_ACCESS_TOKEN is not set — cannot send Instagram messages.');
  }
  if (!instagramSenderId) {
    throw new Error('sendInstagramMessage requires an instagramSenderId.');
  }
 
  const payload = {
    recipient: { id: instagramSenderId },
    message: buildMessagePayload(message),
    messaging_type: 'RESPONSE',
  };
 
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${accessToken}`;
 
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    // fetch throws on DNS/connection failures, not on 4xx/5xx — those are
    // handled below via response.ok.
    throw new Error(`[instagramSender] network error calling Graph API: ${networkErr.message}`);
  }
 
  const data = await response.json().catch(() => ({}));
 
  if (!response.ok) {
    const apiError = data?.error?.message || `HTTP ${response.status}`;
    console.error('[instagramSender] Graph API rejected message:', data?.error || data);
    throw new Error(`[instagramSender] send failed for ${instagramSenderId}: ${apiError}`);
  }
 
  return data;
}
 
/**
 * Converts either a plain string or a buildSendTemplate()-shaped object into
 * the Messenger Platform `message` object the Graph API expects. Instagram
 * messaging shares the Messenger Send API wire format, so 'buttons' becomes
 * a `button` generic template and everything else falls back to plain text.
 */
function buildMessagePayload(message) {
  if (typeof message === 'string') {
    return { text: message };
  }
 
  if (message?.type === 'buttons' && Array.isArray(message.buttons)) {
    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: message.body,
          buttons: message.buttons.slice(0, 3).map((b) => ({
            type: 'postback',
            title: b.label,
            payload: b.id,
          })),
        },
      },
    };
  }
 
  // 'text', 'list' (flattened), 'document'/image links, and any other
  // shape not natively supported by IG all degrade gracefully to text.
  return { text: message?.body || String(message) };
}
 
module.exports = { sendInstagramMessage };