/**
 * src/services/syncService.js
 *
 * Two sync modes, both converging on the same per-message persistence
 * path (emailConversationStore.recordEmailMessage):
 *
 *  - initialSync(accountId): first-time sync right after OAuth connects —
 *    pulls the most recent N messages so the inbox isn't empty, and
 *    records the mailbox's current historyId as the sync watermark.
 *
 *  - incrementalSync(accountId): every sync after that — asks Gmail for
 *    only what changed since the last stored historyId (users.history.list),
 *    which is what both the Pub/Sub webhook handler and the polling
 *    fallback call. Falls back to a fresh initialSync if Gmail reports the
 *    historyId is too old to diff from (its docs say this can happen if
 *    the mailbox has been inactive for a while — Gmail returns 404).
 */

const { pool } = require('@lead/shared');
const gmailApi = require('./gmailApi');
const { parseGmailMessage } = require('./messageParser');
const { getValidAccessToken } = require('./tokenStore');
const emailStore = require('./emailConversationStore');

const INITIAL_SYNC_MESSAGE_COUNT = 25;

async function getAccount(accountId) {
  const { rows } = await pool.query(`SELECT * FROM email_accounts WHERE id=$1`, [accountId]);
  return rows[0] || null;
}

/**
 * Fetches one Gmail message by id, persists it (thread + message +
 * attachment stubs), and returns the parsed message. `direction` is
 * inferred from whether the mailbox's own address is the sender.
 */
async function fetchAndPersistMessage(account, accessToken, gmailMessageId) {
  const full = await gmailApi.getMessage(accessToken, gmailMessageId, 'full');
  const parsed = parseGmailMessage(full);

  const direction = parsed.from && parsed.from.toLowerCase().includes(account.email.toLowerCase())
    ? 'outbound'
    : 'inbound';

  const participants = Array.from(new Set(
    [parsed.from, ...parsed.to, ...parsed.cc].filter(Boolean)
  ));

  const threadRow = await emailStore.upsertEmailThread(account.organization_id, account.id, {
    threadId: parsed.threadId,
    subject: parsed.subject,
    participants,
  });

  const emailMessageId = await emailStore.recordEmailMessage(
    account.organization_id, account.id, threadRow, parsed, { direction }
  );

  if (parsed.attachments.length) {
    await emailStore.recordAttachmentStubs(emailMessageId, parsed.attachments);
  }

  return parsed;
}

/**
 * First sync after connecting a mailbox: grabs the most recent messages
 * (both directions — Gmail's own Sent/Inbox distinction is just a label)
 * and stores the mailbox's *current* historyId so the next sync can diff
 * from here forward instead of re-scanning everything.
 */
async function initialSync(accountId) {
  const account = await getAccount(accountId);
  if (!account) throw new Error('Email account not found.');

  const accessToken = await getValidAccessToken(accountId);
  const profile = await gmailApi.getProfile(accessToken);

  const list = await gmailApi.listMessages(accessToken, { maxResults: INITIAL_SYNC_MESSAGE_COUNT });
  let synced = 0;
  for (const m of list.messages || []) {
    try {
      await fetchAndPersistMessage(account, accessToken, m.id);
      synced++;
    } catch (err) {
      console.error(`[email-sync] Failed to sync message ${m.id}:`, err.message);
    }
  }

  await pool.query(
    `UPDATE email_accounts SET history_id=$2, last_synced_at=now(), last_sync_error=NULL, updated_at=now() WHERE id=$1`,
    [accountId, profile.historyId]
  );

  console.log(`[email-sync] Initial sync for ${account.email}: ${synced} message(s).`);
  return { synced, historyId: profile.historyId };
}

/**
 * Diffs from the account's stored historyId forward. Used by both the
 * Pub/Sub webhook (real-time) and the polling fallback (services/pollWorker.js).
 */
async function incrementalSync(accountId) {
  const account = await getAccount(accountId);
  if (!account) throw new Error('Email account not found.');

  if (!account.history_id) {
    return initialSync(accountId);
  }

  const accessToken = await getValidAccessToken(accountId);

  let pageToken;
  let synced = 0;
  let latestHistoryId = account.history_id;
  const seenMessageIds = new Set();

  try {
    do {
      const page = await gmailApi.listHistory(accessToken, {
        startHistoryId: account.history_id,
        pageToken,
        historyTypes: ['messageAdded'],
      });

      for (const h of page.history || []) {
        for (const added of h.messagesAdded || []) {
          const id = added.message?.id;
          if (!id || seenMessageIds.has(id)) continue;
          seenMessageIds.add(id);
          try {
            await fetchAndPersistMessage(account, accessToken, id);
            synced++;
          } catch (err) {
            console.error(`[email-sync] Failed to sync message ${id}:`, err.message);
          }
        }
      }

      if (page.historyId) latestHistoryId = page.historyId;
      pageToken = page.nextPageToken;
    } while (pageToken);
  } catch (err) {
    // Gmail returns 404 when startHistoryId is too old to diff from
    // (mailbox inactive past Gmail's history retention window).
    if (err.status === 404 || err.gmailError?.code === 404) {
      console.warn(`[email-sync] historyId too old for ${account.email}, falling back to initial sync.`);
      return initialSync(accountId);
    }
    throw err;
  }

  await pool.query(
    `UPDATE email_accounts SET history_id=$2, last_synced_at=now(), last_sync_error=NULL, updated_at=now() WHERE id=$1`,
    [accountId, latestHistoryId]
  );

  console.log(`[email-sync] Incremental sync for ${account.email}: ${synced} new message(s).`);
  return { synced, historyId: latestHistoryId };
}

module.exports = { initialSync, incrementalSync, fetchAndPersistMessage };
