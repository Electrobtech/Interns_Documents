const { pool } = require('@lead/shared');
const messageRepository = require('./messageRepository');

/**
 * Backs the flow engine's CRM-writing node types (tag_contact, create_lead,
 * create_ticket, book_meeting, send_to_inbox). Every function operates on
 * the real contacts/leads/conversations tables the rest of the CRM reads —
 * same reasoning as conversationLinkRepository.js/messageRepository.js:
 * automation-service shares one Postgres instance with every Node service,
 * so this is a plain SQL write, not a network call to contact-service.
 *
 * `create_ticket` and `book_meeting` deliberately do NOT invent a ticketing
 * or calendar system that doesn't exist elsewhere in this CRM. A "ticket" is
 * the same `conversations` row already backing this chat, flagged open with
 * a system transcript line recording the category; a "meeting" is a system
 * transcript line capturing the request (time/topic), left for a human to
 * actually confirm — real primitives the rest of the CRM already reads,
 * not a fabricated result.
 */

/**
 * Writes a Collect Name/Email/Phone/Company node's captured value onto the
 * real contact row, not just session.variables — otherwise "sync captured
 * data to CRM" would only ever happen indirectly, and only if the flow
 * later hits a create_lead node. `company` has no dedicated contacts column
 * (see infra/db/schema.sql), so it's recorded in `notes`, same convention
 * contact-service's own POST /leads uses for company info.
 */
async function updateContactFields({ contactId, field, value }) {
  if (!contactId || !field || !value) return null;
  if (field === 'name') {
    const { rows } = await pool.query(`UPDATE contacts SET name = $1 WHERE id = $2 RETURNING id`, [value, contactId]);
    return rows[0] || null;
  }
  if (field === 'email') {
    const { rows } = await pool.query(`UPDATE contacts SET email = $1 WHERE id = $2 RETURNING id`, [value, contactId]);
    return rows[0] || null;
  }
  if (field === 'phone') {
    const { rows } = await pool.query(`UPDATE contacts SET phone = $1 WHERE id = $2 RETURNING id`, [value, contactId]);
    return rows[0] || null;
  }
  if (field === 'company') {
    const { rows } = await pool.query(
      `UPDATE contacts SET notes = COALESCE(notes || E'\\n', '') || $1 WHERE id = $2 RETURNING id`,
      [`Company: ${value}`, contactId]
    );
    return rows[0] || null;
  }
  return null;
}

/** Appends a tag to the real contact behind this conversation, if not already present. */
async function tagContact({ contactId, tag }) {
  if (!contactId || !tag) return null;
  const { rows } = await pool.query(
    `UPDATE contacts SET tags = array_append(tags, $1::text)
      WHERE id = $2 AND NOT ($1::text = ANY(tags))
      RETURNING id`,
    [tag, contactId]
  );
  return rows[0] || null;
}

/**
 * Creates a lead for the real contact behind this conversation, using
 * whatever the flow has captured so far (name/score via session.variables).
 * Mirrors contact-service's POST /leads scoring convention.
 */
async function createLead({ organizationId, contactId, score, stage }) {
  if (!contactId) return null;
  const priority = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const { rows } = await pool.query(
    `INSERT INTO leads (organization_id, contact_id, stage, priority, score)
     VALUES ($1,$2,COALESCE($3,'new'),$4,COALESCE($5,0))
     RETURNING *`,
    [organizationId, contactId, stage, priority, score ?? 0]
  );
  return rows[0];
}

/** Flags the conversation as a support ticket: reopens it and logs a categorized system note. */
async function createTicket({ organizationId, conversationId, category, summary }) {
  if (!conversationId) return null;
  await pool.query(
    `UPDATE conversations SET status = 'open' WHERE id = $1`,
    [conversationId]
  );
  return messageRepository.logSystem({
    organizationId,
    conversationId,
    body: `Support ticket created${category ? ` — ${category}` : ''}${summary ? `: ${summary}` : ''}`,
    metadata: { kind: 'ticket', category: category || null },
  });
}

/** Records a meeting request as a transcript note — a human confirms/books it; no calendar integration exists yet. */
async function requestMeeting({ organizationId, conversationId, preferredTime, topic }) {
  if (!conversationId) return null;
  return messageRepository.logSystem({
    organizationId,
    conversationId,
    body: `Meeting requested${preferredTime ? ` for ${preferredTime}` : ''}${topic ? ` — ${topic}` : ''}. Needs human confirmation.`,
    metadata: { kind: 'meeting_request', preferredTime: preferredTime || null, topic: topic || null },
  });
}

/** Explicitly flags a conversation for inbox attention without a full handoff (bot keeps ownership). */
async function flagForInbox({ organizationId, conversationId, note }) {
  if (!conversationId) return null;
  await pool.query(
    `UPDATE conversations SET status = 'open' WHERE id = $1 AND status != 'closed'`,
    [conversationId]
  );
  return messageRepository.logSystem({
    organizationId,
    conversationId,
    body: note || 'Flagged for inbox review.',
    metadata: { kind: 'inbox_flag' },
  });
}

module.exports = { updateContactFields, tagContact, createLead, createTicket, requestMeeting, flagForInbox };
