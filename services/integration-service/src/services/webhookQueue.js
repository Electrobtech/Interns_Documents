/**
 * src/services/webhookQueue.js
 *
 * BullMQ queue for incoming Meta webhook events (Instagram/Facebook DMs
 * and comments), backed by the same Redis instance used elsewhere in this
 * service (see services/redisClient.js — that one uses the `redis` package
 * for OAuth state; BullMQ requires ioredis, hence a separate connection
 * here, both pointed at the same REDIS_URL).
 *
 * Flow:
 *   controllers/webhookController.js -> receiveEvent() validates the
 *   signature and calls enqueueWebhookEvent() for each entry, then
 *   returns immediately.
 *
 *   services/webhookWorker.js processes jobs off this queue: normalize ->
 *   look up credentials -> send the auto-reply, with BullMQ's built-in
 *   retry on failure. Started alongside the server in index.js, same
 *   pattern as tokenRefreshJob.js's scheduler.
 */

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const QUEUE_NAME = 'meta-webhook-events';

// BullMQ needs maxRetriesPerRequest: null on the ioredis connection it's
// given (its own recommendation - see BullMQ docs on "Connections").
const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => console.error('[webhook-queue] Redis connection error:', err));

const webhookQueue = new Queue(QUEUE_NAME, { connection });

/**
 * Enqueues one raw webhook entry for async processing.
 * `entry` is a single item from the Meta payload's `body.entry[]`, and
 * `objectType` is the top-level `body.object` ('page' | 'instagram').
 *
 * Retries: 3 attempts total, exponential backoff starting at 5s, so a
 * transient failure (e.g. Graph API hiccup, credentials lookup race)
 * doesn't just get dropped.
 */
async function enqueueWebhookEvent(entry, objectType) {
  return webhookQueue.add(
    'process-event',
    { entry, objectType },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    }
  );
}

module.exports = { webhookQueue, enqueueWebhookEvent, QUEUE_NAME, connection };
