/**
 * src/services/pollWorker.js
 *
 * Fallback sync path from the integration spec ("Fallback: Poll Gmail
 * periodically"). Runs incrementalSync for every connected mailbox on a
 * fixed interval, regardless of whether Pub/Sub watch is configured —
 * cheap insurance against a missed/dropped push notification, and the
 * *only* sync path at all when GMAIL_PUBSUB_TOPIC isn't set.
 *
 * Uses plain setInterval rather than node-cron (unlike watchJob.js) since
 * this needs a configurable-in-minutes interval rather than a fixed daily
 * cron expression.
 */

const { pool, withTenantScope, withSystemAccess } = require('@lead/shared');
const { incrementalSync } = require('./syncService');

const POLL_INTERVAL_MINUTES = parseInt(process.env.EMAIL_POLL_INTERVAL_MINUTES || '5', 10);

async function pollAllAccounts() {
  // Scans across every organization's connected mailboxes — like
  // tokenRefreshJob.js and webhookController.js's cross-tenant lookups —
  // so this initial scan runs under withSystemAccess (see
  // infra/db/rls.sql); each account's own sync work below is then pinned
  // to that account's tenant via withTenantScope.
  const { rows } = await withSystemAccess(() => pool.query(
    `SELECT id, organization_id, email FROM email_accounts WHERE connected = true`
  ));

  for (const row of rows) {
    try {
      // Sync work runs plain pool.query() calls inside emailConversationStore
      // etc. — pin those to this account's tenant so RLS scopes them
      // correctly, same as webhookWorker.js does for inbound Meta events.
      await withTenantScope(row.organization_id, () => incrementalSync(row.id));
    } catch (err) {
      console.error(`[email-poll] Sync failed for ${row.email}:`, err.message);
      await withTenantScope(row.organization_id, () => pool.query(
        `UPDATE email_accounts SET last_sync_error=$2, updated_at=now() WHERE id=$1`,
        [row.id, err.message]
      )).catch(() => {});
    }
  }
}

let intervalHandle = null;

function startPollWorker() {
  if (intervalHandle) return intervalHandle;
  intervalHandle = setInterval(() => {
    pollAllAccounts().catch((err) => console.error('[email-poll] Poll pass failed:', err));
  }, POLL_INTERVAL_MINUTES * 60 * 1000);
  console.log(`[email-poll] Polling fallback started — every ${POLL_INTERVAL_MINUTES} minute(s).`);
  return intervalHandle;
}

module.exports = { startPollWorker, pollAllAccounts };
