/**
 * src/services/smsForwarderService.js
 *
 * Turns a webhook call from a third-party SMS-forwarding app (e.g. SMS
 * Forwarder by frzinapps) running on a business's Android phone into a
 * message in the same conversations/messages tables every other channel
 * uses. See sms-integration-architecture.md for the full design.
 *
 * This channel is receive-only: the forwarder app only pushes messages
 * OUT of the phone, so there is no corresponding "send" path here.
 */

const { pool, withTenantScope, withSystemAccess } = require('@lead/shared');
const conversationStore = require('./conversationStore');

// There's no single official payload shape — forwarder apps are
// reconfigurable (custom body key, custom template, GET vs POST), and can
// change between app versions. Rather than guess once, check a short list
// of common key names for each field, in order, and take the first match.
const TEXT_KEYS = ['message', 'text', 'body', 'content', 'sms', 'msg', 'sms_body'];
const SENDER_KEYS = ['sender', 'from', 'phone', 'number', 'originatingAddress', 'sms_from', 'address'];
const NAME_KEYS = ['contact', 'name', 'sender_name', 'contactName'];

function firstMatch(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/**
 * Merges query params and JSON/form body together (works whether the app
 * is configured for GET or POST), and falls back to treating the entire
 * raw body as the message if nothing structured was parseable.
 */
function parsePayload(body, query) {
  const merged = { ...(query || {}), ...(body && typeof body === 'object' ? body : {}) };

  let text = firstMatch(merged, TEXT_KEYS);
  const sender = firstMatch(merged, SENDER_KEYS);
  const senderName = firstMatch(merged, NAME_KEYS);

  if (!text && typeof body === 'string' && body.trim()) {
    text = body.trim();
  }

  return { text, sender, senderName };
}

/** Unscoped lookup by webhook token — runs before we know the org. */
async function findDeviceByToken(token) {
  const { rows } = await withSystemAccess(() => pool.query(
    `SELECT * FROM sms_devices WHERE webhook_token=$1 LIMIT 1`,
    [token]
  ));
  return rows[0] || null;
}

/**
 * Handles one inbound webhook call for an already-resolved device.
 * Returns the conversation id, or null if nothing parsable was found
 * (still logged via last_raw_payload for debugging).
 */
async function handleInboundSms(device, body, query) {
  const parsed = parsePayload(body, query);
  const rawPayload = { body: body ?? null, query: query ?? null };

  return withTenantScope(device.organization_id, async () => {
    await pool.query(
      `UPDATE sms_devices
          SET last_message_at = CASE WHEN $1::text IS NOT NULL THEN now() ELSE last_message_at END,
              message_count   = message_count + CASE WHEN $1::text IS NOT NULL THEN 1 ELSE 0 END,
              last_raw_payload = $2,
              connected = true,
              updated_at = now()
        WHERE id = $3`,
      [parsed.text, JSON.stringify(rawPayload), device.id]
    );

    // channels has no unique constraint on (organization_id, type), so
    // upsert by hand: update any existing row, insert one only if none
    // exists yet — same pattern as findOrCreateConversation above.
    const { rowCount } = await pool.query(
      `UPDATE channels SET status='connected' WHERE organization_id=$1 AND type='sms'`,
      [device.organization_id]
    );
    if (rowCount === 0) {
      await pool.query(
        `INSERT INTO channels (organization_id, type, display_name, status)
         VALUES ($1, 'sms', 'SMS / RCS', 'connected')`,
        [device.organization_id]
      );
    }

    if (!parsed.text || !parsed.sender) {
      return null;
    }

    return conversationStore.recordInboundMessage(device.organization_id, {
      platform: 'sms',
      senderId: parsed.sender,
      senderName: parsed.senderName,
      text: parsed.text,
      raw: rawPayload,
    });
  });
}

module.exports = { parsePayload, findDeviceByToken, handleInboundSms };
