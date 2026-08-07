/**
 * BullMQ queue — one job per recipient. Mirrors campaign-service's
 * bulkCampaignQueue.js structurally: same delay-based throttle-spacing
 * (recipient i is delayed i * (60000/rate) ms rather than the worker
 * polling a shared rate limiter), same attempts/backoff shape.
 */
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const QUEUE_NAME = 'marketing-hub-recipients';

// BullMQ requires maxRetriesPerRequest: null on the ioredis connection it's
// handed — same requirement bulkCampaignQueue.js already works around.
const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null,
});
connection.on('error', (err) => console.error('[mh-queue] Redis connection error:', err));

const mhQueue = new Queue(QUEUE_NAME, { connection });

/**
 * @param {string} campaignId
 * @param {Array<{id:string, channel:string, destination:string, display_name?:string, rendered_message?:string}>} recipients
 *   Already-inserted mh_recipients rows.
 * @param {object} opts
 * @param {number} [opts.throttlePerMinute=120]
 * @param {string|null} [opts.scheduledAt]
 */
async function enqueueRecipients(campaignId, recipients, opts = {}) {
  const { throttlePerMinute = 120, scheduledAt = null } = opts;
  const spacingMs = Math.max(1, Math.round(60000 / Math.max(1, throttlePerMinute)));
  const baseDelayMs = scheduledAt ? Math.max(0, new Date(scheduledAt).getTime() - Date.now()) : 0;

  const jobs = recipients.map((r, i) => ({
    name: 'send-recipient',
    data: {
      campaignId,
      recipientId: r.id,
      channel: r.channel,
      destination: r.destination,
      name: r.display_name || null,
      body: r.rendered_message || '',
    },
    opts: {
      delay: baseDelayMs + i * spacingMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  }));

  const added = await mhQueue.addBulk(jobs);
  return added.map((job, i) => ({ recipientId: recipients[i].id, jobId: job.id }));
}

module.exports = { mhQueue, enqueueRecipients, QUEUE_NAME, connection };
