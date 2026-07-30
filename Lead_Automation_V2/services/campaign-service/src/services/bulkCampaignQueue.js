/**
 * src/services/bulkCampaignQueue.js
 *
 * BullMQ queue for the Bulk Messaging / Broadcast Campaign feature
 * (frontend/src/components/automation/bulk-campaign/BulkCampaignTab.jsx).
 * One job = one recipient. This mirrors integration-service's
 * webhookQueue.js/webhookWorker.js split (producer here, consumer in
 * bulkCampaignWorker.js), started alongside the server in index.js.
 *
 * Throttling: BullMQ's Worker-level `limiter` option is queue-wide, but
 * each campaign can pick its own send rate (the "10 to 200 SMS/min" slider
 * in BulkCampaignTab.jsx), and the worker is a long-lived singleton that
 * can't be reconfigured per campaign. Instead, the requested rate is baked
 * into each job's `delay` at enqueue time: recipient i for a campaign with
 * throttlePerMinute=R is delayed i * (60000 / R) ms from the campaign's
 * start time, so jobs simply become eligible for pickup at the right pace
 * regardless of how many workers are polling. `bulkCampaignWorker.js`'s
 * own concurrency then just needs to comfortably exceed the fastest
 * configured rate so throttling is actually paced by these delays and not
 * by workers queuing up behind each other.
 */

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const QUEUE_NAME = 'bulk-campaign-recipients';

// BullMQ requires maxRetriesPerRequest: null on the ioredis connection it's
// handed (see BullMQ's "Connections" docs) — same requirement integration-
// service's webhookQueue.js already works around the same way.
const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => console.error('[bulk-campaign-queue] Redis connection error:', err));

const bulkCampaignQueue = new Queue(QUEUE_NAME, { connection });

/**
 * Enqueues every recipient row of a broadcast as its own job, spaced out
 * to respect `throttlePerMinute`.
 *
 * @param {string} campaignId
 * @param {Array<{ id: string, phone: string, name: string, variables: object }>} recipients
 *   Already-inserted `campaign_recipients` rows (need their DB ids so the
 *   worker can update the right row).
 * @param {object} opts
 * @param {number} opts.throttlePerMinute - target send rate for this campaign
 * @param {string} opts.channelType - 'sms' | 'rcs'
 * @param {Date|null} opts.scheduledAt - if set, no job fires before this time
 * @returns {Promise<Array<{ recipientId: string, jobId: string }>>}
 */
async function enqueueBroadcast(campaignId, recipients, opts) {
  const { throttlePerMinute = 60, channelType = 'sms', scheduledAt = null } = opts;

  const spacingMs = Math.max(1, Math.round(60000 / Math.max(1, throttlePerMinute)));
  const baseDelayMs = scheduledAt ? Math.max(0, new Date(scheduledAt).getTime() - Date.now()) : 0;

  const jobs = recipients.map((recipient, i) => ({
    name: 'send-recipient',
    data: {
      campaignId,
      recipientId: recipient.id,
      phone: recipient.phone,
      name: recipient.name,
      variables: recipient.variables || {},
      channelType,
    },
    opts: {
      delay: baseDelayMs + i * spacingMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  }));

  const added = await bulkCampaignQueue.addBulk(jobs);
  return added.map((job, i) => ({ recipientId: recipients[i].id, jobId: job.id }));
}

module.exports = { bulkCampaignQueue, enqueueBroadcast, QUEUE_NAME, connection };
