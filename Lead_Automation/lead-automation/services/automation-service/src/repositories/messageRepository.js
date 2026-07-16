const { pool } = require('@lead/shared');

/**
 * Fail-soft transcript logger. Writes into inbox-service's `messages` table
 * so every inbound customer message and every outbound bot reply shows up
 * in the CRM's Conversations page / Unified Inbox — the same table
 * conversationLinkRepository already resolves contacts/conversations
 * against, so this is a plain insert on the shared pool, not a network
 * call (see conversationLinkRepository.js for the same reasoning).
 *
 * Every exported function swallows its own Postgres errors and resolves
 * to null instead of throwing. A broken transcript write must never break
 * or crash the workflow engine mid-turn, or delay the webhook's fast 200
 * ack back to Meta — callers can call these without wrapping them in their
 * own try/catch and without awaiting them if they don't want to.
 */

async function insertMessage({ organizationId, conversationId, direction, body, sender, messageType, metadata }) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (organization_id, conversation_id, direction, body, sender, message_type, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        organizationId,
        conversationId,
        direction,
        body ?? '',
        sender ?? null,
        messageType || 'text',
        JSON.stringify(metadata || {}),
      ]
    );
    // Keeps the conversation list's "last message" preview/sort in sync,
    // same as inbox-service's own POST /conversations/:id/reply does.
    await pool.query(`UPDATE conversations SET last_message_at = now() WHERE id = $1`, [conversationId]);
    return rows[0];
  } catch (err) {
    console.error('[messageRepository] failed to log message (non-fatal):', err.message);
    return null;
  }
}

/** Turns a normalized inbound `interaction` (see webhookController's NORMALIZERS) into a readable transcript line. */
function describeInteraction(interaction) {
  if (!interaction) return { body: '', messageType: 'text' };
  if (interaction.type === 'text') return { body: interaction.text || '', messageType: 'text' };
  // A real inbound webhook from Meta only ever gives us a raw button/row id
  // (that's all WhatsApp itself sends back) — `label` only exists when this
  // came from the Unified Inbox's "tap an option" simulate flow (see
  // selectOption in the inbox page), which already knows the option's text
  // and can pass it straight through instead of forcing the transcript to
  // show a meaningless internal id like "[list] b_1783594854112".
  if (interaction.type === 'button_click') return { body: interaction.label || `[button] ${interaction.selectedId}`, messageType: 'button_click' };
  if (interaction.type === 'list_select') return { body: interaction.label || `[list] ${interaction.selectedId}`, messageType: 'list_select' };
  return { body: JSON.stringify(interaction), messageType: interaction.type || 'text' };
}

/**
 * Turns a webhookController.buildSendTemplate() result into a readable
 * transcript line. Handles both the WhatsApp-native shapes (text /
 * interactive-button / interactive-list / document) and the generic
 * Instagram/Messenger fallback shape ({ type: messageType, body, ... }).
 * Never called with a 'handoff' template — see logSystem for that case.
 */
function describeTemplate(template) {
  if (!template) return { body: '', messageType: 'text' };
  if (typeof template === 'string') return { body: template, messageType: 'text' };
  if (template.type === 'interactive') {
    const isList = template.interactive?.type === 'list';
    return { body: template.interactive?.body?.text || '', messageType: isList ? 'list' : 'buttons' };
  }
  if (template.type === 'document') {
    return { body: template.caption || template.document?.filename || '', messageType: 'document' };
  }
  if (template.type === 'text') {
    return { body: template.text?.body || '', messageType: 'text' };
  }
  // Generic Instagram/Messenger fallback shape from buildSendTemplate().
  return { body: template.body || '', messageType: template.type || 'text' };
}

/** Logs an inbound customer message as soon as the webhook payload is normalized — before the flow engine runs. */
function logInbound({ organizationId, conversationId, contactExternalId, interaction }) {
  const { body, messageType } = describeInteraction(interaction);
  return insertMessage({
    organizationId,
    conversationId,
    direction: 'inbound',
    body,
    sender: contactExternalId,
    messageType,
    metadata: interaction || {},
  });
}

/** Logs an outbound bot reply that was actually dispatched to the customer via the channel's Send API. */
function logOutbound({ organizationId, conversationId, template }) {
  const { body, messageType } = describeTemplate(template);
  return insertMessage({
    organizationId,
    conversationId,
    direction: 'outbound',
    body,
    sender: 'bot',
    messageType,
    metadata: template || {},
  });
}

/**
 * Logs a non-customer-facing system event — currently just a Handoff node
 * — into the same transcript, so an agent opening the conversation can see
 * *why* the bot stopped replying instead of just seeing the toggle flip.
 */
function logSystem({ organizationId, conversationId, body, metadata }) {
  return insertMessage({
    organizationId,
    conversationId,
    direction: 'outbound',
    body,
    sender: 'system',
    messageType: 'system',
    metadata,
  });
}

module.exports = {
  logInbound,
  logOutbound,
  logSystem,
};