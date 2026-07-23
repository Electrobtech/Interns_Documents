/**
 * src/routes/messages.js
 *
 * Sending and replying. Both accept multipart/form-data (a `meta` field
 * holding JSON, plus 0+ files under `attachments`) rather than
 * base64-in-JSON — same reasoning as automation-service's
 * mediaController.js: avoids blowing past express.json()'s body limit and
 * the ~33% base64 overhead for no reason, for anything but the smallest
 * attachments.
 *
 * Mounted in index.js as: app.use('/email/messages', messagesRoutes)
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { pool } = require('@lead/shared');
const gmailApi = require('../services/gmailApi');
const { getValidAccessToken } = require('../services/tokenStore');
const { buildRawMessage } = require('../services/mimeBuilder');
const { saveBuffer } = require('../services/attachmentStorage');
const emailStore = require('../services/emailConversationStore');

// 20 MB per file, in memory only — never touches disk unless the send
// actually succeeds (see persistOutbound below), matching the size cap
// used elsewhere in this repo (automation-service's document uploads).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function parseMeta(req) {
  try {
    return req.body.meta ? JSON.parse(req.body.meta) : req.body;
  } catch {
    const err = new Error('`meta` must be valid JSON.');
    err.status = 400;
    throw err;
  }
}

/** Loads + decrypts the account row, scoped to the caller's organization. */
async function loadOwnedAccount(organizationId, accountId) {
  const { rows } = await pool.query(
    `SELECT * FROM email_accounts WHERE id=$1 AND organization_id=$2 AND connected=true`,
    [accountId, organizationId]
  );
  if (!rows.length) {
    const err = new Error('Email account not found or not connected.');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

/**
 * Persists a just-sent message: mirrors it into email_threads/email_messages
 * (direction='outbound') and the shared conversations/messages tables,
 * saving any attachments to local storage along the way, then returns the
 * parsed shape recordEmailMessage expects.
 */
async function persistOutbound(account, { threadId, subject, from, to, cc, text, html, rfc822MessageId, inReplyTo }, gmailMessageId, files) {
  const participants = Array.from(new Set([from, ...to, ...(cc || [])].filter(Boolean)));

  const threadRow = await emailStore.upsertEmailThread(account.organization_id, account.id, {
    threadId,
    subject,
    participants,
  });

  const parsedShape = {
    gmailId: gmailMessageId,
    threadId,
    internalDate: new Date(),
    labelIds: ['SENT'],
    snippet: (text || html || '').slice(0, 200),
    from,
    to,
    cc: cc || [],
    subject,
    rfc822MessageId,
    inReplyTo,
    bodyText: text || null,
    bodyHtml: html || null,
    attachments: [],
  };

  const emailMessageId = await emailStore.recordEmailMessage(
    account.organization_id, account.id, threadRow, parsedShape, { direction: 'outbound' }
  );

  for (const file of files || []) {
    const url = saveBuffer(file.buffer, file.originalname);
    await pool.query(
      `INSERT INTO email_attachments (message_id, filename, mime_type, size, url)
       VALUES ($1,$2,$3,$4,$5)`,
      [emailMessageId, file.originalname, file.mimetype, file.size, url]
    );
  }
  if (files?.length) {
    await pool.query(`UPDATE email_messages SET has_attachments=true WHERE id=$1`, [emailMessageId]);
  }

  return threadRow;
}

/**
 * POST /email/messages/send
 * multipart/form-data: meta = { accountId, to: [], cc: [], subject, text, html }
 */
router.post('/send', upload.array('attachments'), async (req, res) => {
  try {
    const meta = parseMeta(req);
    const { accountId, to, cc, subject, text, html } = meta;
    if (!accountId || !to || !to.length || !subject) {
      return res.status(400).json({ error: 'accountId, to, and subject are required.' });
    }

    const account = await loadOwnedAccount(req.user.organizationId, accountId);
    const accessToken = await getValidAccessToken(accountId);

    const raw = buildRawMessage({
      from: account.email,
      to,
      cc,
      subject,
      text,
      html,
      attachments: (req.files || []).map((f) => ({ filename: f.originalname, mimeType: f.mimetype, content: f.buffer })),
    });

    const sent = await gmailApi.sendMessage(accessToken, raw);
    // Gmail's send response doesn't echo Message-Id in an easily
    // machine-readable spot without a follow-up GET, so it's re-fetched
    // here so email_messages.rfc822_message_id / threading data on later
    // replies stays accurate rather than left null.
    const full = await gmailApi.getMessage(accessToken, sent.id, 'metadata');
    const rfc822MessageId = full.payload?.headers?.find((h) => h.name.toLowerCase() === 'message-id')?.value || null;

    const threadRow = await persistOutbound(
      account,
      { threadId: sent.threadId, subject, from: account.email, to, cc, text, html, rfc822MessageId },
      sent.id,
      req.files
    );

    res.status(201).json({ ok: true, gmailMessageId: sent.id, threadId: sent.threadId, conversationId: threadRow.conversation_id });
  } catch (err) {
    console.error('[email-messages] send failed:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /email/messages/reply
 * multipart/form-data: meta = { emailThreadId, text, html }
 * emailThreadId is our email_threads.id (not Gmail's raw threadId) — this
 * route resolves the mailbox, recipients, and In-Reply-To/References from
 * the thread's own last message, so the caller doesn't need to re-supply
 * anything already known from the conversation.
 */
router.post('/reply', upload.array('attachments'), async (req, res) => {
  try {
    const meta = parseMeta(req);
    const { emailThreadId, text, html } = meta;
    if (!emailThreadId) return res.status(400).json({ error: 'emailThreadId is required.' });

    const { rows: threadRows } = await pool.query(
      `SELECT t.*, ea.email AS account_email
         FROM email_threads t JOIN email_accounts ea ON ea.id = t.email_account_id
        WHERE t.id=$1 AND t.organization_id=$2`,
      [emailThreadId, req.user.organizationId]
    );
    const thread = threadRows[0];
    if (!thread) return res.status(404).json({ error: 'Email thread not found.' });

    const account = await loadOwnedAccount(req.user.organizationId, thread.email_account_id);

    const { rows: lastMsgRows } = await pool.query(
      `SELECT * FROM email_messages WHERE thread_id=$1 ORDER BY received_at DESC LIMIT 1`,
      [thread.id]
    );
    const lastMsg = lastMsgRows[0];
    if (!lastMsg) return res.status(400).json({ error: 'This thread has no messages to reply to yet.' });

    // Reply to whoever sent the last message; keep everyone else on the
    // thread cc'd, minus our own mailbox.
    const replyTo = lastMsg.direction === 'inbound' ? [lastMsg.from_email] : lastMsg.to_email;
    const others = Array.from(new Set([...(lastMsg.to_email || []), ...(lastMsg.cc_email || [])]))
      .filter((addr) => addr && addr !== account.email && !replyTo.includes(addr));

    const subject = lastMsg.subject?.toLowerCase().startsWith('re:') ? lastMsg.subject : `Re: ${lastMsg.subject || ''}`;
    const references = [lastMsg.in_reply_to, lastMsg.rfc822_message_id].filter(Boolean).join(' ');

    const accessToken = await getValidAccessToken(account.id);
    const raw = buildRawMessage({
      from: account.email,
      to: replyTo,
      cc: others,
      subject,
      text,
      html,
      inReplyTo: lastMsg.rfc822_message_id,
      references,
      attachments: (req.files || []).map((f) => ({ filename: f.originalname, mimeType: f.mimetype, content: f.buffer })),
    });

    const sent = await gmailApi.sendMessage(accessToken, raw, thread.thread_id);
    const full = await gmailApi.getMessage(accessToken, sent.id, 'metadata');
    const rfc822MessageId = full.payload?.headers?.find((h) => h.name.toLowerCase() === 'message-id')?.value || null;

    const threadRow = await persistOutbound(
      account,
      { threadId: thread.thread_id, subject, from: account.email, to: replyTo, cc: others, text, html, rfc822MessageId, inReplyTo: lastMsg.rfc822_message_id },
      sent.id,
      req.files
    );

    res.status(201).json({ ok: true, gmailMessageId: sent.id, threadId: thread.thread_id, conversationId: threadRow.conversation_id });
  } catch (err) {
    console.error('[email-messages] reply failed:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
