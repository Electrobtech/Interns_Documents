/**
 * src/services/conversationStore.js
 *
 * Persists inbound Meta events (DMs + comments) into the shared
 * conversations/messages/social_comments tables, so they actually show up
 * in inbox-service's /conversations and review-service's /social — and so a
 * human reply typed there has an external_contact_id / external_comment_id
 * to send to.
 *
 * Previously webhookWorker.js only sent an auto-reply and never wrote
 * anything to the DB, so the inbox/social UI had nothing to show or
 * manually reply to.
 */

const { pool } = require('@lead/shared');

/**
 * Finds or creates a contact for an inbound sender, keyed loosely by
 * organization + a source hint, since we don't always have a phone/email —
 * for IG/Messenger senders we only have a platform-scoped id.
 */
async function findOrCreateContact(organizationId, { name, phone, source }) {
  if (phone) {
    const { rows } = await pool.query(
      `SELECT id FROM contacts WHERE organization_id=$1 AND phone=$2 LIMIT 1`,
      [organizationId, phone]
    );
    if (rows.length) return rows[0].id;
  }

  const { rows } = await pool.query(
    `INSERT INTO contacts (organization_id, name, phone, source)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [organizationId, name || null, phone || null, source]
  );
  return rows[0].id;
}

/**
 * Finds or creates the open conversation for a given external thread id
 * (wa_id / IGSID / PSID), and bumps last_message_at.
 */
async function findOrCreateConversation(organizationId, channelType, externalContactId, contactId) {
  const { rows: existing } = await pool.query(
    `SELECT id FROM conversations
      WHERE organization_id=$1 AND channel_type=$2 AND external_contact_id=$3
      ORDER BY created_at DESC LIMIT 1`,
    [organizationId, channelType, externalContactId]
  );

  if (existing.length) {
    await pool.query(`UPDATE conversations SET last_message_at=now() WHERE id=$1`, [existing[0].id]);
    return existing[0].id;
  }

  const { rows } = await pool.query(
    `INSERT INTO conversations (organization_id, contact_id, channel_type, status, external_contact_id)
     VALUES ($1,$2,$3,'open',$4) RETURNING id`,
    [organizationId, contactId, channelType, externalContactId]
  );
  return rows[0].id;
}

/**
 * Records an inbound DM and makes sure a conversation + contact exist for it.
 * Returns the conversation id, so the caller can attach the outbound
 * auto-reply to the same thread.
 */
async function recordInboundMessage(organizationId, event) {
  const contactId = await findOrCreateContact(organizationId, {
    phone: event.platform === 'whatsapp' ? event.senderId : null,
    source: event.platform,
  });
  const conversationId = await findOrCreateConversation(organizationId, event.platform, event.senderId, contactId);

  await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender, external_id)
     VALUES ($1,$2,'inbound',$3,$4,$5)`,
    [organizationId, conversationId, event.text, event.senderId, event.raw?.mid || event.raw?.id || null]
  );

  return conversationId;
}

/**
 * Records an outbound message (e.g. the worker's own auto-reply, or a
 * manual reply sent from inbox-service) against an existing conversation.
 */
async function recordOutboundMessage(organizationId, conversationId, { body, sender, externalId, mediaUrl, mediaType }) {
  const { rows } = await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender, media_url, media_type, external_id)
     VALUES ($1,$2,'outbound',$3,$4,$5,$6,$7) RETURNING *`,
    [organizationId, conversationId, body || null, sender || 'auto-reply', mediaUrl || null, mediaType || null, externalId || null]
  );
  await pool.query(`UPDATE conversations SET last_message_at=now() WHERE id=$1`, [conversationId]);
  return rows[0];
}

/**
 * Records an inbound comment into social_comments (creating a row per
 * distinct external_comment_id), so it shows up under Reviews & Social and
 * can be manually replied to later even if the auto-reply below fails.
 */
async function recordInboundComment(organizationId, event) {
  const { rows: existing } = await pool.query(
    `SELECT id FROM social_comments WHERE organization_id=$1 AND external_comment_id=$2 LIMIT 1`,
    [organizationId, event.conversationId]
  );
  if (existing.length) return existing[0].id;

  const { rows } = await pool.query(
    `INSERT INTO social_comments (organization_id, source, author, body, external_comment_id, post_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [organizationId, event.platform, event.senderId, event.text, event.conversationId, event.raw?.post_id || null]
  );
  return rows[0].id;
}

/** Saves the auto-reply text against the social_comments row's `reply` column. */
async function recordCommentReply(commentRowId, replyText) {
  await pool.query(`UPDATE social_comments SET reply=$1 WHERE id=$2`, [replyText, commentRowId]);
}

module.exports = {
  findOrCreateContact,
  findOrCreateConversation,
  recordInboundMessage,
  recordOutboundMessage,
  recordInboundComment,
  recordCommentReply,
};
