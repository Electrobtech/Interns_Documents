/**
 * src/services/emailConversationStore.js
 *
 * Mirrors integration-service/src/services/conversationStore.js: writes a
 * summarized copy of each Gmail thread/message into the shared
 * conversations/messages tables, so a connected mailbox shows up in the
 * Unified Inbox exactly like WhatsApp/Instagram/Facebook do. Full-fidelity
 * data (headers, HTML body, attachments) stays in email_threads /
 * email_messages / email_attachments — this module is only responsible
 * for keeping the summarized copy in sync.
 */

const { pool } = require('@lead/shared');
const { extractEmailAddress } = require('./messageParser');

/** Finds or creates a contact keyed by (organization, email address). */
async function findOrCreateContact(organizationId, { name, email }) {
  if (email) {
    const { rows } = await pool.query(
      `SELECT id FROM contacts WHERE organization_id=$1 AND email=$2 LIMIT 1`,
      [organizationId, email]
    );
    if (rows.length) return rows[0].id;
  }

  const { rows } = await pool.query(
    `INSERT INTO contacts (organization_id, name, email, source)
     VALUES ($1,$2,$3,'email') RETURNING id`,
    [organizationId, name || email || null, email || null]
  );
  return rows[0].id;
}

/**
 * Finds or creates the conversation backing a Gmail thread, links it to
 * the email_threads row (conversation_id), and bumps last_message_at.
 */
async function findOrCreateConversation(organizationId, gmailThreadId, contactId) {
  const { rows: existing } = await pool.query(
    `SELECT id FROM conversations
      WHERE organization_id=$1 AND channel_type='email' AND external_contact_id=$2
      ORDER BY created_at DESC LIMIT 1`,
    [organizationId, gmailThreadId]
  );

  if (existing.length) {
    await pool.query(`UPDATE conversations SET last_message_at=now() WHERE id=$1`, [existing[0].id]);
    return existing[0].id;
  }

  const { rows } = await pool.query(
    `INSERT INTO conversations (organization_id, contact_id, channel_type, status, external_contact_id)
     VALUES ($1,$2,'email','open',$3) RETURNING id`,
    [organizationId, contactId, gmailThreadId]
  );
  return rows[0].id;
}

/**
 * Upserts the email_threads row for a Gmail thread and links it to a
 * conversation. Idempotent — safe to call for every message in a thread.
 */
async function upsertEmailThread(organizationId, emailAccountId, { threadId, subject, participants }) {
  const contactId = await findOrCreateContact(organizationId, {
    email: participants[0] || null,
    name: participants[0] || null,
  });
  const conversationId = await findOrCreateConversation(organizationId, threadId, contactId);

  const { rows } = await pool.query(
    `INSERT INTO email_threads (organization_id, email_account_id, thread_id, conversation_id, subject, participants, last_message_time)
     VALUES ($1,$2,$3,$4,$5,$6,now())
     ON CONFLICT (email_account_id, thread_id) DO UPDATE SET
       subject=COALESCE(EXCLUDED.subject, email_threads.subject),
       participants=EXCLUDED.participants,
       last_message_time=now()
     RETURNING *`,
    [organizationId, emailAccountId, threadId, conversationId, subject || null, participants]
  );
  return rows[0];
}

/**
 * Records one parsed Gmail message into email_messages, and mirrors a
 * summarized copy into the shared `messages` table for the Unified Inbox.
 * Returns the email_messages row id.
 */
async function recordEmailMessage(organizationId, emailAccountId, emailThreadRow, parsed, { direction }) {
  const { rows: existing } = await pool.query(
    `SELECT id FROM email_messages WHERE email_account_id=$1 AND message_id=$2 LIMIT 1`,
    [emailAccountId, parsed.gmailId]
  );
  if (existing.length) return existing[0].id; // already synced (e.g. re-delivered history event)

  const hasAttachments = parsed.attachments.length > 0;

  const { rows } = await pool.query(
    `INSERT INTO email_messages (
       organization_id, email_account_id, thread_id, message_id, rfc822_message_id, in_reply_to,
       from_email, to_email, cc_email, subject, body, html_body, snippet,
       direction, status, label_ids, has_attachments, received_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [
      organizationId, emailAccountId, emailThreadRow.id, parsed.gmailId, parsed.rfc822MessageId, parsed.inReplyTo,
      extractEmailAddress(parsed.from), parsed.to.map(extractEmailAddress), parsed.cc.map(extractEmailAddress),
      parsed.subject, parsed.bodyText || null, parsed.bodyHtml || null, parsed.snippet,
      direction, direction === 'inbound' ? 'received' : 'sent', parsed.labelIds, hasAttachments, parsed.internalDate,
    ]
  );
  const emailMessageId = rows[0].id;

  // Mirror into the shared messages table for the Unified Inbox. body
  // prefers plain text (falls back to a stripped snippet) so the inbox
  // list/preview doesn't render raw HTML.
  await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender, message_type, subject, external_id, metadata)
     VALUES ($1,$2,$3,$4,$5,'text',$6,$7,$8)`,
    [
      organizationId,
      emailThreadRow.conversation_id,
      direction,
      parsed.bodyText || parsed.snippet || '',
      extractEmailAddress(parsed.from),
      parsed.subject,
      parsed.gmailId,
      JSON.stringify({ threadId: parsed.threadId, hasAttachments }),
    ]
  );
  await pool.query(`UPDATE conversations SET last_message_at=now() WHERE id=$1`, [emailThreadRow.conversation_id]);

  return emailMessageId;
}

/** Bulk-inserts attachment stubs (metadata only; bytes fetched lazily, see routes/attachments.js). */
async function recordAttachmentStubs(emailMessageRowId, attachments) {
  for (const att of attachments) {
    await pool.query(
      `INSERT INTO email_attachments (message_id, filename, mime_type, size, gmail_attachment_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [emailMessageRowId, att.filename, att.mimeType, att.size, att.attachmentId]
    );
  }
}

module.exports = {
  findOrCreateContact,
  findOrCreateConversation,
  upsertEmailThread,
  recordEmailMessage,
  recordAttachmentStubs,
};
