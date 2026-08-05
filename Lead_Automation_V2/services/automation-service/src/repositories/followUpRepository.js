const { pool } = require('@lead/shared');

/**
 * Backs the Automation Builder Handoff node's "auto-create follow-up"
 * option (see FlowBuilder.jsx's handoff config panel + flow-schema.md).
 * Same reasoning as crmActionsRepository.js: automation-service shares one
 * Postgres instance with contact-service, so this is a plain SQL write
 * against the real `follow_ups` table the Follow-ups page/Contact & Lead
 * detail views already read — not a network call to contact-service, and
 * not a fabricated side-channel record.
 *
 * `dueInHours` mirrors the config the Handoff node exposes (24h/48h/custom)
 * — resolved to an absolute due_at here so the Follow-ups page never has to
 * know anything about how it was scheduled.
 */
async function createFromHandoff({
  organizationId,
  contactId,
  conversationId,
  team,
  dueInHours = 24,
  priority = 'medium',
  assignedTo = null,
  channel,
}) {
  if (!contactId) return null;

  // The Handoff node's "assign to" field is free text in the flow builder
  // (same convention as its existing `team` field — see FlowBuilder.jsx),
  // not a picked user id. assigned_to is a real FK to users(id), so only
  // honor it when it actually looks like a UUID (i.e. it was set some other
  // way, e.g. a future user picker); otherwise fold the intent into the
  // note instead of risking an insert error against a UUID column.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const assignedUserId = assignedTo && UUID_RE.test(assignedTo) ? assignedTo : null;
  const assigneeNote = assignedTo && !assignedUserId ? ` Suggested assignee: ${assignedTo}.` : '';

  const { rows } = await pool.query(
    `INSERT INTO follow_ups
       (organization_id, contact_id, conversation_id, due_at, status, priority, assigned_to, notes, source)
     VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval, 'pending', $5, $6, $7, 'automation')
     RETURNING *`,
    [
      organizationId,
      contactId,
      conversationId || null,
      Math.max(1, Number(dueInHours) || 24),
      ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      assignedUserId,
      `Auto-created from ${channel || 'automation'} handoff${team ? ` to ${team}` : ''}.${assigneeNote}`,
    ]
  );
  return rows[0] || null;
}

module.exports = { createFromHandoff };
