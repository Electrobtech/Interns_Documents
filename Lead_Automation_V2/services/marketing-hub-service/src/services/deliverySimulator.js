/**
 * Fabricates the POST-SEND delivered -> read -> replied status timeline.
 *
 * A real send only ever tells you "accepted or rejected" (that's what
 * providers/*.js's sendMessage() simulates) — delivered/read/replied
 * receipts arrive later via the provider's own webhooks, a completely
 * separate code path. This file exists ONLY because there's no real
 * provider wired up to send those webhooks: a real integration deletes
 * this file entirely and adds a POST /marketing-hub/webhooks/:channel
 * handler instead. providers/*.js's sendMessage() is the only thing that
 * function-for-function swaps to a real API — this has no real-world
 * equivalent to become.
 */
const { pool, withSystemAccess } = require('@lead/shared');

// Each step only fires if the previous one did (cumulative delay), so
// probabilities compound down the ladder — matches how a real funnel
// behaves: you can't reply to a message you never read.
const LADDERS = {
  whatsapp: [
    { status: 'delivered', delay: [300, 1500], prob: 0.96 },
    { status: 'read', delay: [1000, 15000], prob: 0.70 },
    { status: 'replied', delay: [2000, 60000], prob: 0.12 },
  ],
  messenger: [
    { status: 'delivered', delay: [300, 1500], prob: 0.96 },
    { status: 'read', delay: [1000, 15000], prob: 0.65 },
    { status: 'replied', delay: [2000, 60000], prob: 0.10 },
  ],
  instagram: [
    { status: 'delivered', delay: [500, 2000], prob: 0.90 },
    { status: 'read', delay: [2000, 20000], prob: 0.50 },
    { status: 'replied', delay: [3000, 60000], prob: 0.08 },
  ],
  sms: [
    { status: 'delivered', delay: [500, 3000], prob: 0.95 }, // no read/reply receipts on SMS
  ],
  email: [
    { status: 'delivered', delay: [1000, 5000], prob: 0.90 },
    { status: 'read', delay: [5000, 120000], prob: 0.35 }, // "read" = simulated open-pixel
  ],
  linkedin: [
    { status: 'delivered', delay: [500, 3000], prob: 0.95 }, // campaigns only — no per-recipient DM concept to progress further
  ],
};

const COLUMN_FOR_STATUS = { delivered: 'delivered_at', read: 'read_at', replied: 'replied_at' };

function randBetween([min, max]) {
  return min + Math.random() * (max - min);
}

/**
 * Schedules the rest of one recipient's status ladder after a successful
 * send. Fire-and-forget by design (nothing awaits this) — failures are
 * logged, never thrown.
 */
function scheduleDeliveryProgression(recipientId, channel, { onUpdate } = {}) {
  const ladder = LADDERS[channel] || [];
  let cumulativeDelay = 0;

  for (const step of ladder) {
    cumulativeDelay += randBetween(step.delay);
    setTimeout(() => {
      advanceRecipient(recipientId, step.status, step.prob, onUpdate).catch((err) =>
        console.error(`[deliverySimulator] failed to advance recipient ${recipientId} to ${step.status}:`, err.message)
      );
    }, cumulativeDelay);
  }
}

async function advanceRecipient(recipientId, status, prob, onUpdate) {
  if (Math.random() >= prob) return; // this step of the ladder doesn't happen for this recipient

  await withSystemAccess(async () => {
    // Only advance out of a state that precedes `status` — a recipient whose
    // send later failed, or one a duplicate timer already advanced, must not
    // be silently overwritten.
    const { rows } = await pool.query(
      `UPDATE mh_recipients
          SET status = $1, ${COLUMN_FOR_STATUS[status]} = now(), updated_at = now()
        WHERE id = $2 AND status NOT IN ('failed', $1)
        RETURNING campaign_id`,
      [status, recipientId]
    );
    if (!rows[0]) return;
    const campaignId = rows[0].campaign_id;
    await pool.query(
      `INSERT INTO mh_delivery_events (recipient_id, campaign_id, event_type) VALUES ($1,$2,$3)`,
      [recipientId, campaignId, status]
    );
    await onUpdate?.(campaignId);
  });
}

module.exports = { scheduleDeliveryProgression };
