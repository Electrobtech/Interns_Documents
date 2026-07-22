const { pool } = require('@lead/shared');

// One counter row per (scopeKey, window bucket, limitType). See
// throttleService.js for how scopeKey/bucket are built, and the design
// note above the `throttle_counters` table in infra/db/schema.sql for why
// this is a separate table from conversation_sessions.

/**
 * Atomically increments the plain count-based counters
 * (conversation_count / message_count), upserting the row if it doesn't
 * exist yet. `INSERT ... ON CONFLICT DO UPDATE` is a single round trip and
 * takes a row-level lock for the duration of the statement, so concurrent
 * webhook requests hitting the same scope/bucket serialize cleanly —
 * equivalent to Mongo's atomic $inc/upsert, just without needing the
 * separate upsert-then-read step.
 *
 * @returns {Promise<number>} the count AFTER incrementing.
 */
async function incrementCount({ scopeKey, bucket, limitType }) {
  const { rows } = await pool.query(
    `INSERT INTO throttle_counters (scope_key, bucket, limit_type, count)
     VALUES ($1,$2,$3,1)
     ON CONFLICT (scope_key, bucket, limit_type)
     DO UPDATE SET count = throttle_counters.count + 1, updated_at = now()
     RETURNING count`,
    [scopeKey, bucket, limitType]
  );
  return rows[0].count;
}

/** Rolls back a count-based counter by 1 (used when an increment pushed it over the limit). */
async function decrementCount({ scopeKey, bucket, limitType }) {
  await pool.query(
    `UPDATE throttle_counters
        SET count = count - 1, updated_at = now()
      WHERE scope_key = $1 AND bucket = $2 AND limit_type = $3`,
    [scopeKey, bucket, limitType]
  );
}

/**
 * Atomically adds `contactId` to the seen-contacts set for a
 * unique_contact_count counter, upserting the row if needed. Uses
 * array_append guarded by a NOT-already-present check so a repeat contact
 * never inflates the array — the same idempotency $addToSet gave us in
 * Mongo — and returns the resulting array length as the current count.
 *
 * @returns {Promise<number>} the number of unique contacts seen AFTER this call.
 */
async function addSeenContact({ scopeKey, bucket, limitType, contactId }) {
  const { rows } = await pool.query(
    `INSERT INTO throttle_counters (scope_key, bucket, limit_type, seen_contact_ids)
     VALUES ($1,$2,$3,ARRAY[$4]::text[])
     ON CONFLICT (scope_key, bucket, limit_type)
     DO UPDATE SET
       seen_contact_ids = CASE
         WHEN $4 = ANY(throttle_counters.seen_contact_ids) THEN throttle_counters.seen_contact_ids
         ELSE array_append(throttle_counters.seen_contact_ids, $4)
       END,
       updated_at = now()
     RETURNING array_length(seen_contact_ids, 1) AS count`,
    [scopeKey, bucket, limitType, contactId]
  );
  return rows[0].count;
}

/** Rolls back a unique_contact_count counter by removing `contactId` (used when a first-sight add pushed it over the limit). */
async function removeSeenContact({ scopeKey, bucket, limitType, contactId }) {
  await pool.query(
    `UPDATE throttle_counters
        SET seen_contact_ids = array_remove(seen_contact_ids, $4), updated_at = now()
      WHERE scope_key = $1 AND bucket = $2 AND limit_type = $3`,
    [scopeKey, bucket, limitType, contactId]
  );
}

module.exports = { incrementCount, decrementCount, addSeenContact, removeSeenContact };
