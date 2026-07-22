const { pool } = require('@lead/shared');

/**
 * Bridges automation-service's world (playbooks, conversation_sessions,
 * keyed by raw `contact_external_id` strings like a WhatsApp phone number)
 * to inbox-service's world (contacts, conversations, keyed by internal
 * UUIDs) — so a Handoff node reached inside a flow shows up as an actual
 * bot/human state on the conversation an agent sees in the CRM inbox,
 * instead of being purely internal automation-service bookkeeping.
 *
 * Both services share one Postgres database (see docker-compose.yml), so
 * this is a plain cross-table join/upsert rather than a network call.
 */

/**
 * Finds the contact this inbound webhook event belongs to, creating one if
 * this is the first time this channel identity has messaged in. Keyed on
 * (organization_id, source, external_id) — see the partial unique index in
 * infra/db/schema.sql — so retried/duplicate webhook deliveries resolve to
 * the same contact instead of creating duplicates.
 */
async function findOrCreateContact({ organizationId, channel, externalId }) {
  const existing = await pool.query(
    `SELECT * FROM contacts WHERE organization_id = $1 AND source = $2 AND external_id = $3`,
    [organizationId, channel, externalId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const { rows } = await pool.query(
    `INSERT INTO contacts (organization_id, name, source, external_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, source, external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET source = EXCLUDED.source
     RETURNING *`,
    [organizationId, externalId, channel, externalId]
  );
  return rows[0];
}

/**
 * Finds the most recent non-closed conversation for this contact on this
 * channel, or opens a fresh one (bot-handled by default) if none exists.
 * Deliberately re-resolved on every webhook call rather than cached on the
 * automation session, so a human closing/reopening a conversation in the
 * CRM is always reflected on the very next inbound message.
 */
async function findOrCreateConversation({ organizationId, contactId, channel }) {
  const existing = await pool.query(
    `SELECT * FROM conversations
      WHERE organization_id = $1 AND contact_id = $2 AND channel_type = $3 AND status != 'closed'
      ORDER BY last_message_at DESC
      LIMIT 1`,
    [organizationId, contactId, channel]
  );
  if (existing.rows[0]) return existing.rows[0];

  const { rows } = await pool.query(
    `INSERT INTO conversations (organization_id, contact_id, channel_type, status, handled_by)
     VALUES ($1, $2, $3, 'open', 'bot')
     RETURNING *`,
    [organizationId, contactId, channel]
  );
  return rows[0];
}

/** Convenience wrapper: resolve straight from a webhook event to the linked conversation row. */
async function resolveConversation({ organizationId, channel, externalId }) {
  const contact = await findOrCreateContact({ organizationId, channel, externalId });
  return findOrCreateConversation({ organizationId, contactId: contact.id, channel });
}

/**
 * Pins to an EXACT known conversation rather than re-resolving "most
 * recently active open conversation for this contact/channel" from
 * scratch. Needed because a contact can have more than one open
 * conversation on the same channel (e.g. seeded demo data, or a customer
 * who messaged in, got closed out, and messaged in again) — resolveConversation()
 * above has no way to know which one a CRM user is looking at in the
 * Unified Inbox, so it can silently pick a different one than what's on
 * screen. inboxReplyController.js already has the real conversationId from
 * the URL the user is viewing, so it should use this instead.
 */
async function resolveConversationById({ conversationId, organizationId }) {
  const { rows } = await pool.query(
    `SELECT * FROM conversations WHERE id = $1 AND organization_id = $2`,
    [conversationId, organizationId]
  );
  return rows[0] || null;
}

/**
 * Flips who owns replying on this conversation. Called with 'human' when
 * the flow reaches a Handoff node; called with either value from the
 * inbox UI's toggle (see PUT /conversations/:id/handled-by in inbox-service).
 * Also nudges `status` to 'pending' on handoff so it surfaces in the CRM's
 * existing open/pending/missed filtering as needing attention.
 */
async function setHandledBy({ conversationId, handledBy }) {
  const { rows } = await pool.query(
    `UPDATE conversations
        SET handled_by = $1,
            status = CASE WHEN $1 = 'human' AND status = 'open' THEN 'pending' ELSE status END
      WHERE id = $2
      RETURNING *`,
    [handledBy, conversationId]
  );
  return rows[0];
}

module.exports = {
  findOrCreateContact,
  findOrCreateConversation,
  resolveConversation,
  resolveConversationById,
  setHandledBy,
};