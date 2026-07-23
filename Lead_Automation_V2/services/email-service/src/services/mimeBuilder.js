/**
 * src/services/mimeBuilder.js
 *
 * Builds the raw RFC 2822 MIME message Gmail's `messages.send` expects
 * (base64url-encoded in the `raw` field). Handles the plain send case and
 * the multipart/mixed case (HTML body + file attachments), and sets
 * In-Reply-To / References so a reply Gmail-threads correctly even when
 * threadId alone wouldn't be enough (e.g. the recipient's own client
 * checks these headers too — see "Threading" in the integration spec).
 */

const crypto = require('crypto');

function encodeHeaderValue(value) {
  // Keep this simple: only encode if non-ASCII is present, using
  // RFC 2047 "encoded-word" syntax — good enough for subjects with
  // accented characters etc. without pulling in a MIME library.
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function toBase64Url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * @param {object} opts
 * @param {string} opts.from
 * @param {string[]} opts.to
 * @param {string[]} [opts.cc]
 * @param {string} opts.subject
 * @param {string} [opts.text]  plain-text body
 * @param {string} [opts.html]  HTML body (sent as multipart/alternative with text, if both given)
 * @param {string} [opts.inReplyTo]   Message-Id header of the message being replied to
 * @param {string} [opts.references]  full References chain (parent's References + parent's Message-Id)
 * @param {{filename: string, mimeType: string, content: Buffer}[]} [opts.attachments]
 * @returns {string} base64url-encoded raw message, ready for gmailApi.sendMessage
 */
function buildRawMessage({ from, to, cc, subject, text, html, inReplyTo, references, attachments = [] }) {
  const boundaryMixed = `mixed_${crypto.randomBytes(12).toString('hex')}`;
  const boundaryAlt = `alt_${crypto.randomBytes(12).toString('hex')}`;

  const headers = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
    cc && cc.length ? `Cc: ${cc.join(', ')}` : null,
    `Subject: ${encodeHeaderValue(subject || '')}`,
    'MIME-Version: 1.0',
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
  ].filter(Boolean);

  const hasAttachments = attachments.length > 0;
  const hasBothBodies = Boolean(text) && Boolean(html);

  let bodySection;
  if (hasBothBodies) {
    bodySection =
      `Content-Type: multipart/alternative; boundary="${boundaryAlt}"\r\n\r\n` +
      `--${boundaryAlt}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n\r\n${text}\r\n\r\n` +
      `--${boundaryAlt}\r\n` +
      `Content-Type: text/html; charset="UTF-8"\r\n\r\n${html}\r\n\r\n` +
      `--${boundaryAlt}--`;
  } else if (html) {
    bodySection = `Content-Type: text/html; charset="UTF-8"\r\n\r\n${html}`;
  } else {
    bodySection = `Content-Type: text/plain; charset="UTF-8"\r\n\r\n${text || ''}`;
  }

  if (!hasAttachments) {
    return toBase64Url(Buffer.from(`${headers.join('\r\n')}\r\n${bodySection}`, 'utf8'));
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);

  const parts = [`--${boundaryMixed}\r\n${bodySection}`];

  for (const att of attachments) {
    const b64 = att.content.toString('base64').replace(/(.{76})/g, '$1\r\n');
    parts.push(
      `--${boundaryMixed}\r\n` +
      `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"\r\n` +
      `Content-Disposition: attachment; filename="${att.filename}"\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n${b64}`
    );
  }
  parts.push(`--${boundaryMixed}--`);

  const message = `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n\r\n')}`;
  return toBase64Url(Buffer.from(message, 'utf8'));
}

module.exports = { buildRawMessage };
