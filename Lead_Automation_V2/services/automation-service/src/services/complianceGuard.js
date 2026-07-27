/**
 * src/services/complianceGuard.js
 *
 * Centralizes the two Meta platform rules that actually block or should
 * block a send, so both the live webhook engine turn
 * (controllers/webhookController.js) and campaign broadcasts
 * (controllers/campaignSendController.js) enforce them the same way
 * instead of each reimplementing it:
 *
 *   1. Opt-out: once a contact has sent a STOP/UNSUBSCRIBE-style keyword,
 *      Meta requires you stop messaging them. `resolvePlaybook()` in
 *      webhookController.js already *routes* that keyword to an
 *      "unsubscribe" playbook, but routing alone doesn't stop the NEXT
 *      message — nothing persisted the fact, so a campaign sent five
 *      minutes later would go out anyway. This module adds the persisted
 *      `contacts.opted_out` flag and the check against it.
 *
 *   2. The 24-hour customer service window: outside 24h of the contact's
 *      last inbound message, WhatsApp only allows pre-approved template
 *      messages — a free-form send gets rejected by the Cloud API. This
 *      checks the window and returns a clear, actionable reason *before*
 *      attempting the send, rather than letting the Cloud API 4xx and
 *      surfacing a generic "failed to send" error.
 *
 * Neither check applies to real Meta message templates (`template.type
 * === 'template'`) — those are the one message type Meta allows outside
 * the window, and (for utility templates) even to some opted-out
 * categories. Nothing in this codebase sends real templates yet — see the
 * note on TEMPLATE_TYPE below — so today this only ever exempts a type
 * that never actually appears, and every free-form send goes through the
 * checks below.
 */

const { pool } = require('@lead/shared');

const WINDOW_HOURS = 24;
const TEMPLATE_TYPE = 'template'; // Cloud API's real pre-approved-template message type

// Common opt-out phrasing. Meta doesn't mandate a specific keyword list for
// WhatsApp (unlike US SMS carriers' required STOP), but these are the
// conventional ones users actually type, matched as a whole normalized
// message rather than a substring so e.g. "please stop sending offers,
// I'm still interested in support" doesn't false-positive.
const OPT_OUT_PHRASES = ['stop', 'unsubscribe', 'opt out', 'optout', 'cancel', 'stop promotions'];

function isOptOutText(text) {
  const normalized = (text || '').toLowerCase().trim();
  return OPT_OUT_PHRASES.includes(normalized);
}

/** Cheap flag lookup — used at the top of a turn, before any reply is computed. */
async function isContactOptedOut(contactId) {
  if (!contactId) return false;
  const { rows } = await pool.query(`SELECT opted_out FROM contacts WHERE id = $1`, [contactId]);
  return !!rows[0]?.opted_out;
}

/**
 * Persists the opt-out. Called AFTER the current turn's reply has already
 * been allowed to send (see webhookController.js) — the contact is still
 * owed their one "you've been unsubscribed" confirmation; this only blocks
 * turns/campaigns from here on.
 */
async function recordOptOut({ contactId }) {
  if (!contactId) return;
  await pool.query(
    `UPDATE contacts SET opted_out = true, opted_out_at = now() WHERE id = $1 AND opted_out = false`,
    [contactId]
  );
}

/** Timestamp of the contact's most recent inbound message on this conversation, or null if they've never messaged. */
async function lastInboundAt(conversationId) {
  const { rows } = await pool.query(
    `SELECT MAX(created_at) AS at FROM messages WHERE conversation_id = $1 AND direction = 'inbound'`,
    [conversationId]
  );
  return rows[0]?.at || null;
}

/**
 * The actual gate. Call this immediately before attempting to send.
 * Returns { allowed: true } or { allowed: false, reason, code } — callers
 * decide what to do with a block (skip the send, log a system transcript
 * line, surface an error to the campaign UI, etc.) rather than this module
 * reaching into messageRepository itself, since the right response differs
 * by caller (silent skip for a bot turn vs. a 4xx for a campaign send).
 */
async function checkSendAllowed({ contactId, conversationId, template }) {
  if (template?.type === TEMPLATE_TYPE) {
    // Real pre-approved templates are exempt from both checks below —
    // that's the entire point of the template mechanism.
    return { allowed: true };
  }

  if (await isContactOptedOut(contactId)) {
    return { allowed: false, code: 'opted_out', reason: 'Contact has opted out of messages on this channel.' };
  }

  const last = await lastInboundAt(conversationId);
  if (!last) {
    return {
      allowed: false,
      code: 'outside_window_never_messaged',
      reason: 'This contact has never messaged in — only a pre-approved template message can open the conversation.',
    };
  }

  const hoursSinceLastInbound = (Date.now() - new Date(last).getTime()) / 3_600_000;
  if (hoursSinceLastInbound > WINDOW_HOURS) {
    return {
      allowed: false,
      code: 'outside_window',
      reason: `Outside the 24-hour customer service window (last inbound message was ${hoursSinceLastInbound.toFixed(1)}h ago) — only a pre-approved template message is allowed.`,
    };
  }

  return { allowed: true };
}

module.exports = {
  WINDOW_HOURS,
  isOptOutText,
  isContactOptedOut,
  recordOptOut,
  lastInboundAt,
  checkSendAllowed,
};
