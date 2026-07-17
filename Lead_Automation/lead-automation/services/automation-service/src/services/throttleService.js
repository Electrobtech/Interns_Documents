const throttleCounterRepository = require('../repositories/throttleCounterRepository');
const { getCurrentBucket } = require('./bucketUtils');

/**
 * Atomically checks-and-increments a throttle counter.
 *
 * Postgres has no native "increment only if below N" primitive either, so
 * this keeps the same atomic-counter-with-rollback pattern the Mongo version
 * used:
 *   1. Increment first (atomic upsert via INSERT ... ON CONFLICT) — the row
 *      lock taken by that statement means concurrent webhook requests for
 *      the same scope/bucket serialize instead of racing.
 *   2. Read the resulting count (returned directly by the same query).
 *   3. If it exceeds maxCount, immediately decrement back down (-1) and
 *      report "denied".
 * Steps 1-3 keep the counter accurate even under heavy concurrent webhook
 * traffic without needing a multi-statement transaction.
 *
 * @returns {Promise<{ allowed: boolean, currentCount: number, maxCount: number }>}
 */
async function checkAndIncrement({ scopeKey, limitType, maxCount, window, contactId = null }) {
  // No limit configured at all -> always allow, skip DB round-trip entirely.
  if (maxCount === null || maxCount === undefined) {
    return { allowed: true, currentCount: null, maxCount: null };
  }

  const bucket = getCurrentBucket(window);

  if (limitType === 'unique_contact_count') {
    // array_append (guarded against duplicates) is naturally idempotent —
    // a repeat contact never inflates the count.
    const currentCount = await throttleCounterRepository.addSeenContact({
      scopeKey, bucket, limitType, contactId
    });
    if (currentCount > maxCount) {
      // Roll back: remove the contact we just (over-)added.
      await throttleCounterRepository.removeSeenContact({ scopeKey, bucket, limitType, contactId });
      return { allowed: false, currentCount: maxCount, maxCount };
    }
    return { allowed: true, currentCount, maxCount };
  }

  // conversation_count / message_count share the same simple increment pattern.
  const count = await throttleCounterRepository.incrementCount({ scopeKey, bucket, limitType });

  if (count > maxCount) {
    await throttleCounterRepository.decrementCount({ scopeKey, bucket, limitType });
    return { allowed: false, currentCount: maxCount, maxCount };
  }

  return { allowed: true, currentCount: count, maxCount };
}

/** Builds the scopeKey string for a throttle node per its configured scope. */
function buildScopeKey({ scope, playbookId, nodeId, clientId }) {
  switch (scope) {
    case 'node':   return `${playbookId}:${nodeId}`;
    case 'client': return `client:${clientId}`;
    case 'flow':
    default:       return `${playbookId}`;
  }
}

module.exports = { checkAndIncrement, buildScopeKey };
