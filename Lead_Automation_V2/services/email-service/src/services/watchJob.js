/**
 * src/services/watchJob.js
 *
 * Registers (and daily renews) a Gmail Pub/Sub push subscription per
 * connected mailbox, per the integration spec's "Preferred: Gmail Watch
 * API + Google Pub/Sub + Webhook" path. Google's watch lease lasts at most
 * 7 days, so this re-registers anything expiring within the next day.
 *
 * Only runs if GMAIL_PUBSUB_TOPIC is set — deployments without a Google
 * Cloud Pub/Sub topic configured simply rely on services/pollWorker.js's
 * periodic polling instead (the spec's documented fallback), so watch
 * registration failures here are logged but never fatal to the service.
 */

const cron = require('node-cron');
const { pool, withSystemAccess, withTenantScope } = require('@lead/shared');
const gmailApi = require('./gmailApi');
const { getValidAccessToken } = require('./tokenStore');

const RENEW_WINDOW_HOURS = 24;

async function registerWatch(accountId) {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) return null; // not configured — polling fallback covers this account instead

  const accessToken = await getValidAccessToken(accountId);
  const result = await gmailApi.watch(accessToken, topicName);
  // result: { historyId, expiration } — expiration is epoch millis as a string
  const expiresAt = new Date(Number(result.expiration));

  await pool.query(
    `UPDATE email_accounts SET watch_expires_at=$2, updated_at=now() WHERE id=$1`,
    [accountId, expiresAt]
  );

  console.log(`[email-watch] Registered watch for account ${accountId}, expires ${expiresAt.toISOString()}`);
  return { expiresAt };
}

async function renewExpiringWatches() {
  if (!process.env.GMAIL_PUBSUB_TOPIC) return { checked: 0, renewed: 0, failed: 0 };

  const cutoff = new Date(Date.now() + RENEW_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  // Cross-tenant scan (every organization's mailboxes at once), same
  // reasoning as pollWorker.js/webhookController.js — needs withSystemAccess.
  const { rows } = await withSystemAccess(() => pool.query(
    `SELECT id, organization_id, email FROM email_accounts
      WHERE connected = true
        AND (watch_expires_at IS NULL OR watch_expires_at < $1)`,
    [cutoff]
  ));

  let renewed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await withTenantScope(row.organization_id, () => registerWatch(row.id));
      renewed++;
    } catch (err) {
      console.error(`[email-watch] Failed to renew watch for ${row.email}:`, err.message);
      failed++;
    }
  }

  console.log(`[email-watch] Renewal pass done. Checked: ${rows.length}, renewed: ${renewed}, failed: ${failed}.`);
  return { checked: rows.length, renewed, failed };
}

function startWatchRenewalScheduler() {
  if (!process.env.GMAIL_PUBSUB_TOPIC) {
    console.log('[email-watch] GMAIL_PUBSUB_TOPIC not set — skipping watch registration, relying on polling fallback (see services/pollWorker.js).');
    return;
  }
  // Runs daily at 2:00 AM server time — comfortably inside the 24h renewal window.
  cron.schedule('0 2 * * *', () => {
    renewExpiringWatches().catch((err) => console.error('[email-watch] Scheduled renewal run failed:', err));
  });
  console.log('[email-watch] Scheduler registered — runs daily at 2:00 AM.');
}

module.exports = { registerWatch, renewExpiringWatches, startWatchRenewalScheduler };
