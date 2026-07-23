/**
 * src/services/messageParser.js
 *
 * Converts a raw Gmail API message resource (gmailApi.getMessage's
 * response, format=full) into the flat shape email_messages/syncService
 * actually need: headers pulled out by name, plain-text + HTML bodies
 * decoded from base64url, and a flat list of attachment stubs (metadata
 * only — bytes are fetched on demand later via gmailApi.getAttachment,
 * see attachments.js).
 *
 * This is the ONE place that should know about Gmail's nested
 * multipart/MIME `payload.parts` structure — everything downstream only
 * ever sees the normalized shape below.
 */

function decodeBase64Url(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function headerValue(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

/** Splits a comma-separated "A <a@x.com>, B <b@x.com>" header into an array of raw entries. */
function splitAddressList(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Walks payload.parts recursively, collecting the first text/plain body,
 * the first text/html body, and every part that carries a filename
 * (attachments — including inline images, which still get a filename in
 * Gmail's payload even when referenced via Content-ID in the HTML).
 */
function walkParts(part, acc) {
  if (!part) return;

  const mimeType = part.mimeType || '';
  const filename = part.filename;

  if (filename) {
    acc.attachments.push({
      filename,
      mimeType: mimeType || 'application/octet-stream',
      size: part.body?.size || 0,
      attachmentId: part.body?.attachmentId || null,
    });
  } else if (mimeType === 'text/plain' && part.body?.data && !acc.bodyText) {
    acc.bodyText = decodeBase64Url(part.body.data);
  } else if (mimeType === 'text/html' && part.body?.data && !acc.bodyHtml) {
    acc.bodyHtml = decodeBase64Url(part.body.data);
  }

  for (const child of part.parts || []) walkParts(child, acc);
}

/**
 * Normalized shape:
 * {
 *   gmailId, threadId, historyId, internalDate, labelIds, snippet,
 *   from, to: [], cc: [], subject,
 *   rfc822MessageId, inReplyTo, references,
 *   bodyText, bodyHtml,
 *   attachments: [{ filename, mimeType, size, attachmentId }]
 * }
 */
function parseGmailMessage(msg) {
  const headers = msg.payload?.headers || [];
  const acc = { bodyText: '', bodyHtml: '', attachments: [] };

  if (msg.payload) walkParts(msg.payload, acc);

  // Single-part messages (no `parts` array) carry the body directly on
  // payload.body instead — walkParts above already handles this since it's
  // called on payload itself, but a plain-text-only message with no
  // filename and no nested parts falls through walkParts' mimeType check
  // fine as-is (payload.mimeType is text/plain in that case).

  return {
    gmailId: msg.id,
    threadId: msg.threadId,
    historyId: msg.historyId,
    internalDate: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
    labelIds: msg.labelIds || [],
    snippet: msg.snippet || '',
    from: headerValue(headers, 'From'),
    to: splitAddressList(headerValue(headers, 'To')),
    cc: splitAddressList(headerValue(headers, 'Cc')),
    subject: headerValue(headers, 'Subject') || '(no subject)',
    rfc822MessageId: headerValue(headers, 'Message-Id') || headerValue(headers, 'Message-ID'),
    inReplyTo: headerValue(headers, 'In-Reply-To'),
    references: headerValue(headers, 'References'),
    bodyText: acc.bodyText,
    bodyHtml: acc.bodyHtml,
    attachments: acc.attachments,
  };
}

/** Extracts just the bare "user@domain.com" out of a "Name <user@domain.com>" header value. */
function extractEmailAddress(headerVal) {
  if (!headerVal) return null;
  const match = headerVal.match(/<([^>]+)>/);
  return (match ? match[1] : headerVal).trim().toLowerCase();
}

module.exports = { parseGmailMessage, extractEmailAddress, splitAddressList };
