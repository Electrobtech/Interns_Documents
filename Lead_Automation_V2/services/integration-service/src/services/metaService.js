/**
 * src/services/metaService.js
 *
 * Handles direct communication with Instagram's Graph API for messaging,
 * using the FACEBOOK LOGIN FOR BUSINESS flow (matching routes/auth.js,
 * routes/instagram.js, routes/facebook.js).
 *
 * IMPORTANT: this project's saved tokens come from Facebook Login for
 * Business (see routes/auth.js), so all calls go through
 * graph.facebook.com using the Page access token — NOT graph.instagram.com.
 *
 * MULTI-TENANCY: these functions take `credentials` as a parameter rather
 * than looking them up internally. Incoming webhook events identify the
 * account via Meta's own Page/IG ID (not an organizationId or JWT), so the
 * caller (webhookController.js) is responsible for resolving the right
 * organization's credentials first, via credentials.getCredentialsByMetaId(),
 * then passing them in here.
 */

const { GRAPH_URL, withAuth } = require('./graphApi');

/**
 * Fetch basic profile info for a connected Instagram Business Account.
 * Useful as a quick sanity check that a saved token is valid and working.
 */
async function getInstagramProfile(credentials) {
  const { instagram_business_account_id, page_access_token } = credentials;

  const url = `${GRAPH_URL}/${instagram_business_account_id}?` +
    withAuth({ fields: 'id,username' }, page_access_token);

  const resp = await fetch(url);
  const data = await resp.json();

  if (!resp.ok || data.error) {
    throw new Error(`Failed to fetch IG profile: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Send a reply message to a user on Instagram (DM).
 * recipientId is the Instagram-scoped sender ID from the incoming
 * webhook event (event.senderId in the normalized shape).
 */
async function sendMessage(credentials, recipientId, text) {
  const { instagram_business_account_id, page_access_token } = credentials;

  const resp = await fetch(`${GRAPH_URL}/${instagram_business_account_id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: withAuth(
      {
        recipient: JSON.stringify({ id: recipientId }),
        message: JSON.stringify({ text }),
      },
      page_access_token
    ),
  });

  const data = await resp.json();

  if (!resp.ok || data.error) {
    throw new Error(`Failed to send message: ${JSON.stringify(data)}`);
  }

  return data; // { recipient_id, message_id }
}

/**
 * Send a Messenger DM reply from the Page (as opposed to sendMessage above,
 * which sends from the Instagram Business Account). recipientId is the
 * Messenger PSID from the incoming webhook event.
 */
async function sendPageMessage(credentials, recipientId, text) {
  const { page_id, page_access_token } = credentials;

  const resp = await fetch(`${GRAPH_URL}/${page_id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: withAuth(
      {
        recipient: JSON.stringify({ id: recipientId }),
        message: JSON.stringify({ text }),
        messaging_type: 'RESPONSE',
      },
      page_access_token
    ),
  });

  const data = await resp.json();

  if (!resp.ok || data.error) {
    throw new Error(`Failed to send Page message: ${JSON.stringify(data)}`);
  }

  return data; // { recipient_id, message_id }
}

/**
 * Reply to a comment on a post/media.
 * commentId comes from the normalized webhook event's conversationId
 * for type: 'comment'.
 */
async function replyToComment(credentials, commentId, text) {
  const { page_access_token } = credentials;

  const resp = await fetch(`${GRAPH_URL}/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: withAuth({ message: text }, page_access_token),
  });

  const data = await resp.json();

  if (!resp.ok || data.error) {
    throw new Error(`Failed to reply to comment: ${JSON.stringify(data)}`);
  }

  return data;
}

module.exports = {
  getInstagramProfile,
  sendMessage,
  sendPageMessage,
  replyToComment,
};