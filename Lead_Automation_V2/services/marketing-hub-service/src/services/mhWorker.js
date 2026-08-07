/**
 * Consumes `marketing-hub-recipients` jobs from mhQueue.js: one job per
 * recipient. Mirrors campaign-service's bulkCampaignWorker.js structurally
 * (same withSystemAccess-then-withTenantScope job pattern, same
 * re-derive-aggregates-every-time status refresh) but dispatches to the
 * right channel provider (providers/index.js) instead of a single hardcoded
 * simulateProviderSend(), and hands a successful send off to
 * deliverySimulator.js for the post-send delivered/read/replied timeline.
 */
const { Worker } = require('bullmq');
const { pool, withTenantScope, withSystemAccess } = require('@lead/shared');
const { QUEUE_NAME, connection } = require('./mhQueue');
const providers = require('../providers');
const { scheduleDeliveryProgression } = require('./deliverySimulator');

const CONCURRENCY = parseInt(process.env.MH_WORKER_CONCURRENCY || '10', 10);

let ioRef = null;
// Set once from index.js after Socket.io is constructed — avoids a circular
// require between this module and realtime.js at load time.
function attachIo(io) {
  ioRef = io;
}

/**
 * Re-derives every aggregate counter on the campaign row from its
 * recipients' current states, same discipline as campaign-service's
 * refreshCampaignStatus(): always correct even if two jobs/timers finish
 * concurrently, since each call just re-reads the source of truth rather
 * than trusting a running counter.
 */
async function refreshCampaignCounters(campaignId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('sent','delivered','read','replied'))  AS sent,
       COUNT(*) FILTER (WHERE status IN ('delivered','read','replied'))        AS delivered,
       COUNT(*) FILTER (WHERE status IN ('read','replied'))                     AS read,
       COUNT(*) FILTER (WHERE status = 'replied')                               AS replied,
       COUNT(*) FILTER (WHERE status = 'failed')                                AS failed,
       COUNT(*) FILTER (WHERE status NOT IN ('queued','sending'))               AS attempted,
       COUNT(*)                                                                 AS total
     FROM mh_recipients WHERE campaign_id = $1`,
    [campaignId]
  );
  const c = rows[0];
  const attempted = Number(c.attempted);
  const total = Number(c.total);
  const succeeded = Number(c.sent);
  const status = attempted < total ? 'processing' : (succeeded > 0 ? 'completed' : 'failed');

  const { rows: updated } = await pool.query(
    `UPDATE mh_campaigns
        SET sent_count=$1, delivered_count=$2, read_count=$3, replied_count=$4, failed_count=$5,
            status = CASE WHEN status IN ('draft','scheduled') THEN status ELSE $6 END,
            updated_at = now()
      WHERE id=$7
      RETURNING organization_id, status`,
    [c.sent, c.delivered, c.read, c.replied, c.failed, status, campaignId]
  );
  const campaign = updated[0];
  if (campaign && ioRef) {
    ioRef.to(`org:${campaign.organization_id}`).emit('campaign:updated', {
      id: campaignId,
      status: campaign.status,
      sent_count: Number(c.sent),
      delivered_count: Number(c.delivered),
      read_count: Number(c.read),
      replied_count: Number(c.replied),
      failed_count: Number(c.failed),
      total_recipients: total,
    });
  }
}

/**
 * Processes one recipient job. Throwing lets BullMQ's retry/backoff run its
 * 3 attempts before the recipient is finally marked 'failed' — the `failed`
 * worker event below only fires once every attempt is exhausted.
 */
async function processRecipientJob(job) {
  const { campaignId, recipientId, channel, destination, name, body } = job.data;

  // Job payloads carry no tenant context the way an authenticated HTTP
  // request does — this initial lookup runs unscoped (system access), then
  // everything else runs pinned to the campaign's own org.
  const { rows: campaignRows } = await withSystemAccess(() =>
    pool.query(`SELECT organization_id FROM mh_campaigns WHERE id = $1`, [campaignId])
  );
  const campaignRow = campaignRows[0];
  if (!campaignRow) throw new Error(`Campaign ${campaignId} not found`);

  await withTenantScope(campaignRow.organization_id, async () => {
    await pool.query(`UPDATE mh_recipients SET status='sending', updated_at=now() WHERE id=$1`, [recipientId]);

    const provider = providers[channel];
    if (!provider) throw new Error(`No provider registered for channel "${channel}"`);

    try {
      const { providerMessageId } = await provider.sendMessage({ destination, name, body });
      await pool.query(
        `UPDATE mh_recipients
            SET status='sent', error=NULL, attempts=attempts+1, job_id=$1,
                provider_message_id=$2, sent_at=now(), updated_at=now()
          WHERE id=$3`,
        [job.id, providerMessageId, recipientId]
      );
      await pool.query(
        `INSERT INTO mh_delivery_events (recipient_id, campaign_id, event_type) VALUES ($1,$2,'sent')`,
        [recipientId, campaignId]
      );
      // Fire-and-forget: the delivered/read/replied ladder runs on its own
      // timers well after this job (and its tenant scope) has completed.
      scheduleDeliveryProgression(recipientId, channel, { onUpdate: () => refreshCampaignCounters(campaignId) });
    } catch (err) {
      const isFinalAttempt = job.attemptsMade + 1 >= job.opts.attempts;
      await pool.query(
        `UPDATE mh_recipients SET status=$1, error=$2, attempts=attempts+1, job_id=$3, updated_at=now() WHERE id=$4`,
        [isFinalAttempt ? 'failed' : 'queued', err.message, job.id, recipientId]
      );
      if (isFinalAttempt) {
        await pool.query(
          `INSERT INTO mh_delivery_events (recipient_id, campaign_id, event_type) VALUES ($1,$2,'failed')`,
          [recipientId, campaignId]
        );
      }
      throw err; // re-throw so BullMQ still counts/retries the attempt
    } finally {
      await refreshCampaignCounters(campaignId);
    }
  });
}

let worker = null;

function startMhWorker() {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processRecipientJob, { connection, concurrency: CONCURRENCY });

  worker.on('completed', (job) => {
    console.log(`[mh-worker] Recipient job ${job.id} (campaign ${job.data.campaignId}) sent.`);
  });
  worker.on('failed', (job, err) => {
    console.error(
      `[mh-worker] Recipient job ${job?.id} (campaign ${job?.data?.campaignId}) failed ` +
      `(attempt ${job?.attemptsMade}):`, err.message
    );
  });

  console.log(`[mh-worker] Worker started for queue "${QUEUE_NAME}" (concurrency: ${CONCURRENCY}).`);
  return worker;
}

module.exports = { startMhWorker, processRecipientJob, refreshCampaignCounters, attachIo };
