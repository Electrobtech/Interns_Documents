/**
 * src/services/bulkCampaignWorker.js
 *
 * Consumes `bulk-campaign-recipients` jobs from bulkCampaignQueue.js: one
 * job per recipient, already spaced out at enqueue time to respect the
 * campaign's configured send rate (see bulkCampaignQueue.js's comment on
 * throttling).
 *
 * Why this simulates the send rather than calling a real carrier API:
 * this codebase's actual SMS channel (services/integration-service/src/
 * services/smsForwarderService.js, backed by a phone running a third-party
 * forwarding app) is explicitly receive-only — there is no outbound SMS
 * provider wired up anywhere in the project yet. That's also why the
 * existing single-number tab is literally named "Simulate"
 * (SmsAutomationSimulator.jsx). This worker follows the same convention at
 * bulk scale: realistic latency + a small simulated failure rate, so the
 * Bulk Campaign tab's live progress panel has real (if synthetic) sent/
 * failed counts to show, retries to demonstrate, etc. Swapping in a real
 * provider later only means changing `simulateProviderSend()` below — the
 * queue, retry/backoff, and progress-tracking plumbing around it doesn't
 * change.
 */

const { Worker } = require('bullmq');
const { pool, withTenantScope, withSystemAccess } = require('@lead/shared');
const { QUEUE_NAME, connection } = require('./bulkCampaignQueue');

const CONCURRENCY = parseInt(process.env.BULK_CAMPAIGN_WORKER_CONCURRENCY || '10', 10);

// Simulated carrier behavior — tune here without touching the queue/worker
// wiring. A real integration would replace simulateProviderSend()'s body
// with an actual Twilio/SMS-gateway API call and keep everything below it
// (status updates, counters, retry-on-throw) unchanged.
const SIMULATED_MIN_LATENCY_MS = 150;
const SIMULATED_MAX_LATENCY_MS = 900;
const SIMULATED_FAILURE_RATE = 0.04; // ~4% of sends simulate a carrier-side failure

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Naive {{variable}} substitution against a recipient's mapped columns. */
function renderTemplate(template, variables) {
  if (!template) return '';
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => (variables?.[key] ?? ''));
}

/**
 * Resolves the message text to send for one recipient: renders the
 * campaign's own `message_body` — the SMS flow template the user picked in
 * BulkCampaignTab.jsx's Flow/Template dropdown, which comes from
 * SmsAutomationSimulator.jsx's local flow catalog and travels to the
 * backend as a plain string (there's no SMS-side playbooks table to look
 * up server-side, unlike the WhatsApp/Instagram Playbook Studio) —
 * against this recipient's own mapped variables.
 */
function resolveMessageBody(messageBody, variables) {
  return renderTemplate(messageBody || 'Hi {{name}}, this is an update from us.', variables);
}

/** Stand-in for a real Twilio/SMS Gateway call — see file header. */
async function simulateProviderSend(phone, body) {
  await sleep(SIMULATED_MIN_LATENCY_MS + Math.random() * (SIMULATED_MAX_LATENCY_MS - SIMULATED_MIN_LATENCY_MS));
  if (Math.random() < SIMULATED_FAILURE_RATE) {
    throw new Error(`Simulated carrier rejection for ${phone} (e.g. invalid number / temporarily unreachable)`);
  }
  return { providerMessageId: `sim_${Date.now()}_${Math.round(Math.random() * 1e6)}` };
}

/**
 * Recomputes and stores a campaign's aggregate status from its recipients'
 * current states. Runs after every single recipient update rather than
 * trying to track a running counter separately, so it's always consistent
 * even if two jobs finish concurrently (each just re-derives from the
 * source of truth in campaign_recipients).
 */
async function refreshCampaignStatus(campaignId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
       COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
       COUNT(*)                                   AS total
     FROM campaign_recipients WHERE campaign_id = $1`,
    [campaignId]
  );
  const { sent, failed, total } = rows[0];
  const done = Number(sent) + Number(failed);
  const status = done === 0 ? 'processing' : done < total ? 'processing' : (Number(sent) > 0 ? 'completed' : 'failed');

  await pool.query(
    `UPDATE campaigns SET sent_count = $1, failed_count = $2, status = $3 WHERE id = $4`,
    [sent, failed, status, campaignId]
  );
}

/**
 * Processes one recipient job. Throwing lets BullMQ's retry/backoff
 * (bulkCampaignQueue.js's job options) run its 3 attempts before the
 * recipient is finally marked 'failed' — see the `failed` worker event
 * below, which only fires once every attempt has been exhausted.
 */
async function processRecipientJob(job) {
  const { campaignId, recipientId, phone, name, variables } = job.data;

  // Jobs are queued organization-agnostic (campaign-service doesn't carry
  // per-job tenant context the way an authenticated HTTP request does), so
  // scope Postgres RLS for the duration of this job the same way
  // integration-service's webhook worker does for its own background jobs.
  //
  // This initial lookup itself runs before any tenant scope exists — we
  // don't know the organization until after reading this row — so it has
  // to go through withSystemAccess, the same way webhookWorker.js's
  // getCredentialsByMetaId() does for its own pre-scope lookup. A bare
  // pool.query() here would run on an unscoped connection, and campaigns'
  // RLS policy fails closed on that (zero rows), so this would otherwise
  // throw "Campaign not found" on every single job.
  const { rows: campaignRows } = await withSystemAccess(() => pool.query(
    `SELECT organization_id, message_body FROM campaigns WHERE id = $1`,
    [campaignId]
  ));
  const campaignRow = campaignRows[0];
  if (!campaignRow) throw new Error(`Campaign ${campaignId} not found`);
  const { organization_id: organizationId, message_body: messageBody } = campaignRow;

  await withTenantScope(organizationId, async () => {
    const body = resolveMessageBody(messageBody, { name, ...variables });

    try {
      await simulateProviderSend(phone, body);
      await pool.query(
        `UPDATE campaign_recipients
            SET status = 'sent', error = NULL, attempts = attempts + 1, job_id = $1,
                rendered_message = $2, sent_at = now(), updated_at = now()
          WHERE id = $3`,
        [job.id, body, recipientId]
      );
    } catch (err) {
      const isFinalAttempt = job.attemptsMade + 1 >= job.opts.attempts;
      await pool.query(
        `UPDATE campaign_recipients
            SET status = $1, error = $2, attempts = attempts + 1, job_id = $3,
                rendered_message = $4, updated_at = now()
          WHERE id = $5`,
        [isFinalAttempt ? 'failed' : 'pending', err.message, job.id, body, recipientId]
      );
      throw err; // re-throw so BullMQ still counts/retries the attempt
    } finally {
      await refreshCampaignStatus(campaignId);
    }
  });
}

let worker = null;

function startBulkCampaignWorker() {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processRecipientJob, {
    connection,
    concurrency: CONCURRENCY,
  });

  worker.on('completed', (job) => {
    console.log(`[bulk-campaign-worker] Recipient job ${job.id} (campaign ${job.data.campaignId}) sent.`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[bulk-campaign-worker] Recipient job ${job?.id} (campaign ${job?.data?.campaignId}) failed ` +
      `(attempt ${job?.attemptsMade}):`, err.message
    );
  });

  console.log(`[bulk-campaign-worker] Worker started for queue "${QUEUE_NAME}" (concurrency: ${CONCURRENCY}).`);
  return worker;
}

module.exports = { startBulkCampaignWorker, processRecipientJob };
