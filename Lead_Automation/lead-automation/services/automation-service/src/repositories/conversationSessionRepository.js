const { pool } = require('@lead/shared');

// One document (row) per (playbook, contact) conversation instance.
// This is the single source of truth for "where is this user in the tree".
// See infra/db/schema.sql for the partial-unique-index equivalent of the
// old Mongo partialFilterExpression that keeps only one *active* session
// per (playbook_id, contact_external_id).

/** Maps a raw `conversation_sessions` row to the camelCase shape the engine expects. */
function toSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    playbookId: row.playbook_id,
    clientId: row.organization_id,
    channel: row.channel,
    contactExternalId: row.contact_external_id,
    currentNodeId: row.current_node_id,
    status: row.status,
    variables: row.variables || {},
    pathHistory: row.path_history || [],
    messageCount: row.message_count,
    startedAt: row.started_at,
    lastInteractionAt: row.last_interaction_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * ConversationSession.findOne({ playbookId, contactExternalId, status: 'active' })
 * equivalent — used by workflowEngine to resolve the in-progress session for
 * this turn.
 */
async function findActiveByPlaybookAndContact({ playbookId, contactExternalId }) {
  const { rows } = await pool.query(
    `SELECT * FROM conversation_sessions
      WHERE playbook_id = $1 AND contact_external_id = $2 AND status = 'active'
      LIMIT 1`,
    [playbookId, contactExternalId]
  );
  return toSession(rows[0]);
}

/**
 * ConversationSession.findOne({ clientId, channel, contactExternalId, status: 'active' })
 * equivalent — used by webhookController.resolvePlaybook to find whether
 * this contact is already mid-flow on any playbook for the channel.
 */
async function findActiveByChannelAndContact({ clientId, channel, contactExternalId }) {
  const { rows } = await pool.query(
    `SELECT * FROM conversation_sessions
      WHERE organization_id = $1 AND channel = $2 AND contact_external_id = $3 AND status = 'active'
      LIMIT 1`,
    [clientId, channel, contactExternalId]
  );
  return toSession(rows[0]);
}

/**
 * ConversationSession.create({...}) equivalent — starts a brand-new session
 * at the playbook's entry node. The active-session-per-(playbook,contact)
 * uniqueness is enforced by ux_conversation_sessions_active; a 23505 unique
 * violation here means a racing webhook retry beat this one to it.
 */
async function create({ playbookId, clientId, channel, contactExternalId, currentNodeId }) {
  const { rows } = await pool.query(
    `INSERT INTO conversation_sessions (
       playbook_id, organization_id, channel, contact_external_id, current_node_id,
       status, variables, path_history, message_count
     ) VALUES ($1,$2,$3,$4,$5,'active','{}'::jsonb,'[]'::jsonb,0)
     RETURNING *`,
    [playbookId, clientId, channel, contactExternalId, currentNodeId]
  );
  return toSession(rows[0]);
}

/**
 * session.save() equivalent — persists the mutated in-memory session back
 * to its row (new position, appended path history, counters, status).
 * Takes the full camelCase session object (as returned by this module) so
 * callers can keep mutating it in place exactly as they did with the
 * Mongoose document, then hand it back here at the end of the turn.
 */
async function save(session) {
  const { rows } = await pool.query(
    `UPDATE conversation_sessions SET
       current_node_id     = $1,
       status              = $2,
       variables           = $3,
       path_history        = $4,
       message_count       = $5,
       last_interaction_at = $6,
       updated_at          = now()
     WHERE id = $7
     RETURNING *`,
    [
      session.currentNodeId,
      session.status,
      JSON.stringify(session.variables || {}),
      JSON.stringify(session.pathHistory || []),
      session.messageCount,
      session.lastInteractionAt,
      session.id,
    ]
  );
  return toSession(rows[0]);
}

/**
 * ConversationSession.deleteOne({ clientId, contactExternalId, playbookId })
 * equivalent — used by the Diagnostic Bench's "reset" helper to drop a test
 * session so a Simulate run can start fresh.
 */
async function deleteOne({ clientId, contactExternalId, playbookId }) {
  await pool.query(
    `DELETE FROM conversation_sessions
      WHERE organization_id = $1 AND contact_external_id = $2 AND playbook_id = $3`,
    [clientId, contactExternalId, playbookId]
  );
}

module.exports = {
  toSession,
  findActiveByPlaybookAndContact,
  findActiveByChannelAndContact,
  create,
  save,
  deleteOne,
};
