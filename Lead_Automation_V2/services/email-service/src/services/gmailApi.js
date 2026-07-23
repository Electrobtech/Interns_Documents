/**
 * src/services/gmailApi.js
 *
 * Thin wrapper over the Gmail REST API (https://gmail.googleapis.com).
 * Uses plain fetch rather than the `googleapis` npm package, matching the
 * fetch-based style already used for Meta's Graph API
 * (integration-service/src/services/graphApi.js) and Google's own OAuth
 * endpoints (review-service/src/google/oauthClient.js) elsewhere in this
 * repo — one fewer heavyweight dependency, and every call site already
 * has to hand-manage the accessToken anyway (see tokenStore.js).
 */

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailFetch(accessToken, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Gmail API error (${res.status})`);
    err.status = res.status === 401 ? 401 : 502;
    err.gmailError = data.error;
    throw err;
  }
  return data;
}

/** GET /profile — { emailAddress, messagesTotal, threadsTotal, historyId } */
function getProfile(accessToken) {
  return gmailFetch(accessToken, '/profile');
}

/** GET /messages — paginated list of { id, threadId } (no body/headers). */
function listMessages(accessToken, { q, pageToken, maxResults = 50, labelIds } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (pageToken) params.set('pageToken', pageToken);
  if (maxResults) params.set('maxResults', String(maxResults));
  for (const label of labelIds || []) params.append('labelIds', label);
  return gmailFetch(accessToken, `/messages?${params.toString()}`);
}

/** GET /messages/{id} — full message (headers/body/attachment metadata). */
function getMessage(accessToken, messageId, format = 'full') {
  return gmailFetch(accessToken, `/messages/${messageId}?format=${format}`);
}

/** GET /messages/{id}/attachments/{attachmentId} — { size, data (base64url) } */
function getAttachment(accessToken, messageId, attachmentId) {
  return gmailFetch(accessToken, `/messages/${messageId}/attachments/${attachmentId}`);
}

/** POST /messages/send — body: { raw, threadId? } (raw = base64url RFC822 MIME) */
function sendMessage(accessToken, raw, threadId) {
  return gmailFetch(accessToken, '/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
  });
}

/** GET /history — incremental changes since startHistoryId. */
function listHistory(accessToken, { startHistoryId, pageToken, historyTypes } = {}) {
  const params = new URLSearchParams({ startHistoryId });
  if (pageToken) params.set('pageToken', pageToken);
  for (const t of historyTypes || ['messageAdded']) params.append('historyTypes', t);
  return gmailFetch(accessToken, `/history?${params.toString()}`);
}

/**
 * POST /watch — registers a Cloud Pub/Sub push subscription for this
 * mailbox. Lease lasts up to 7 days (Google's limit); services/watchJob.js
 * renews it before it expires. topicName looks like
 * "projects/<project>/topics/<topic>".
 */
function watch(accessToken, topicName, labelIds = ['INBOX']) {
  return gmailFetch(accessToken, '/watch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicName, labelIds, labelFilterAction: 'include' }),
  });
}

/** POST /stop — cancels the push subscription (called on disconnect). */
function stopWatch(accessToken) {
  return gmailFetch(accessToken, '/stop', { method: 'POST' });
}

module.exports = {
  getProfile,
  listMessages,
  getMessage,
  getAttachment,
  sendMessage,
  listHistory,
  watch,
  stopWatch,
};
