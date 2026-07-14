/**
 * src/services/messageNormalizer.js
 *
 * Converts Meta's raw webhook entry payloads (Facebook Messenger,
 * Instagram DMs, comments) into one common internal shape that
 * ai-service / inbox-service can consume regardless of platform.
 *
 * This is the ONE place that should know about Meta's specific payload
 * quirks — everything downstream should only ever see the normalized shape.
 */

/**
 * Normalized event shape (what every platform adapter should produce):
 * {
 *   platform: 'facebook' | 'instagram',
 *   type: 'message' | 'comment',
 *   pageId: string,          // the Page this event arrived on
 *   senderId: string,        // platform-specific user/PSID
 *   recipientId: string,     // usually your Page/IG account
 *   conversationId: string,  // thread identifier, for replying
 *   text: string,
 *   timestamp: number,       // epoch ms
 *   raw: object              // original payload, kept for debugging
 * }
 */

function normalizeMetaEvent(entry, objectType) {
  const events = [];

  // --- Messenger / Instagram DMs ---
  // These arrive under entry.messaging[]
  if (Array.isArray(entry.messaging)) {
    for (const msg of entry.messaging) {
      // Skip echo events (messages your own Page sent) and read receipts —
      // otherwise you'll process your own auto-replies as new incoming messages.
      if (msg.message?.is_echo) continue;
      if (!msg.message?.text) continue;

      events.push({
        platform: objectType === 'instagram' ? 'instagram' : 'facebook',
        type: 'message',
        pageId: entry.id,
        senderId: msg.sender?.id,
        recipientId: msg.recipient?.id,
        conversationId: msg.sender?.id, // Messenger/IG DMs: sender ID doubles as thread ID
        text: msg.message.text,
        timestamp: msg.timestamp,
        raw: msg
      });
    }
  }

  // --- Comments (e.g. on Page posts or IG media) ---
  // These arrive under entry.changes[] with field === 'feed' or 'comments'
  if (Array.isArray(entry.changes)) {
    for (const change of entry.changes) {
      if (change.field !== 'feed' && change.field !== 'comments') continue;

      const value = change.value;
      if (!value?.message && !value?.text) continue;

      events.push({
        platform: objectType === 'instagram' ? 'instagram' : 'facebook',
        type: 'comment',
        pageId: entry.id,
        senderId: value.from?.id,
        recipientId: entry.id,
        conversationId: value.comment_id || value.post_id,
        text: value.message || value.text,
        timestamp: entry.time,
        raw: value
      });
    }
  }

  return events;
}

module.exports = { normalizeMetaEvent };