/**
 * src/services/webhookWorker.js
 *
 * BullMQ worker that does the actual work for incoming Meta webhook
 * events: normalizeMetaEvent -> look up the owning organization's
 * credentials -> send the auto-reply (DM or comment).
 *
 * This used to run synchronously inside controllers/webhookController.js's
 * request handler; it's now dequeued from services/webhookQueue.js instead,
 * with BullMQ's built-in retry (see enqueueWebhookEvent's job options) on
 * failure - e.g. a transient Graph API error no longer just silently drops
 * the reply.
 *
 * Started alongside the Express server in index.js via
 * startWebhookWorker(), same pattern as tokenRefreshJob.js's
 * startTokenRefreshScheduler().
 */

const { Worker } = require('bullmq');
const { withTenantScope, pool } = require('@lead/shared');
const { normalizeMetaEvent } = require('./messageNormalizer');
const metaService = require('./metaService');
const whatsappService = require('./whatsappService');
const { getCredentialsByMetaId } = require('./credentials');
const { QUEUE_NAME, connection } = require('./webhookQueue');
const {
  recordInboundMessage,
  recordOutboundMessage,
  recordInboundComment,
  recordCommentReply,
} = require('./conversationStore');

const CONCURRENCY = parseInt(process.env.WEBHOOK_WORKER_CONCURRENCY || '5', 10);

// Same opt-out phrase list as automation-service's complianceGuard.js —
// duplicated rather than cross-imported, consistent with how this service
// already keeps its own small constants (e.g. GRAPH_API_VERSION) separate
// from automation-service's copies rather than reaching into another
// service's src/.
const OPT_OUT_PHRASES = new Set(['stop', 'unsubscribe', 'opt out', 'optout', 'cancel', 'stop promotions']);

/**
 * Reject an inbound message from this fully-generic auto-reply path
 * ("Thanks for your message!") for a contact who has opted out on any
 * channel — see automation-service's complianceGuard.js for the fuller
 * playbook-engine version of this same rule. Both paths write to the same
 * `contacts.opted_out` column, so an opt-out recorded via one path (e.g. a
 * WhatsApp STOP handled by automation-service) also silences this one.
 */
async function isContactOptedOut(conversationId) {
  const { rows } = await pool.query(
    `SELECT ct.opted_out FROM contacts ct
       JOIN conversations c ON c.contact_id = ct.id
      WHERE c.id = $1`,
    [conversationId]
  );
  return !!rows[0]?.opted_out;
}

async function recordOptOutIfNeeded(conversationId, text) {
  const normalized = (text || '').toLowerCase().trim();
  if (!OPT_OUT_PHRASES.has(normalized)) return;
  await pool.query(
    `UPDATE contacts SET opted_out = true, opted_out_at = now()
      WHERE id = (SELECT contact_id FROM conversations WHERE id = $1) AND opted_out = false`,
    [conversationId]
  );
}

/**
 * Persists the inbound DM (so it shows up in the inbox even if auto-reply
 * fails below), then sends an automatic reply.
 *
 * This is a background job, not an HTTP request, so there's no
 * `authenticate` middleware pinning a tenant-scoped DB connection for us —
 * we do it ourselves with withTenantScope once getCredentialsByMetaId has
 * told us which organization this event belongs to (see infra/db/rls.sql).
 *
 * TODO: replace the hardcoded replyText with a real call to ai-service,
 * e.g.:
 *   const replyText = await aiService.generateReply(event.text);
 */
async function handleIncomingMessage(metaEntryId, event) {
  const { organizationId, credentials } = await getCredentialsByMetaId(metaEntryId);

  await withTenantScope(organizationId, async () => {
    const conversationId = await recordInboundMessage(organizationId, event);

    // Meta compliance: a contact who has already opted out (STOP/
    // UNSUBSCRIBE, recorded either here or via automation-service's
    // playbook engine — both write the same contacts.opted_out column)
    // must not get another automated reply. The inbound message is still
    // recorded above so a human can see it.
    if (await isContactOptedOut(conversationId)) {
      console.log(`[webhook-worker] skipping auto-reply — contact has opted out (conversation ${conversationId})`);
      return;
    }

    const replyText = `Thanks for your message! We received: "${event.text}"`;

    const result = event.platform === 'whatsapp'
      ? await whatsappService.sendTextMessage(credentials, event.senderId, replyText)
      : await metaService.sendMessage(credentials, event.senderId, replyText);

    await recordOutboundMessage(organizationId, conversationId, {
      body: replyText,
      sender: 'auto-reply',
      externalId: result?.messages?.[0]?.id || result?.message_id || null,
    });

    // Recorded AFTER this turn's reply went out, same reasoning as
    // automation-service's complianceGuard: the contact is still owed
    // this one acknowledgement; only the NEXT message/campaign is blocked.
    await recordOptOutIfNeeded(conversationId, event.text);

    console.log('Auto-reply sent:', result);
  });
}

/**
 * Persists the inbound comment into social_comments, then sends an
 * automatic reply on Meta's side and records the reply text on that row.
 *
 * Guards against reply loops: if the comment's own author matches the
 * connected Page/IG account itself (e.g. an echo of our own reply, or a
 * comment we made elsewhere), we skip it - otherwise a reply could
 * trigger another "new comment" event and loop indefinitely.
 *
 * TODO: replace the hardcoded replyText with a real call to ai-service,
 * e.g.:
 *   const replyText = await aiService.generateReply(event.text);
 */
async function handleIncomingComment(metaEntryId, event) {
  const { organizationId, credentials } = await getCredentialsByMetaId(metaEntryId);

  await withTenantScope(organizationId, async () => {
    const commentRowId = await recordInboundComment(organizationId, event);

    const ownAccountIds = [
      credentials.page_id,
      credentials.instagram_business_account_id,
    ].filter(Boolean);

    if (ownAccountIds.includes(event.senderId)) {
      console.log('Skipping comment from our own account (avoiding reply loop).');
      return;
    }

    const replyText = `Thanks for your comment: "${event.text}"`;
    const result = await metaService.replyToComment(credentials, event.conversationId, replyText);
    await recordCommentReply(commentRowId, replyText);
    console.log('Auto-reply to comment sent:', result);
  });
}

/**
 * Processes one queued job: { entry, objectType } -> normalize -> dispatch.
 * Throwing here is what triggers BullMQ's retry/backoff (see
 * webhookQueue.js's job options) - so unlike the old synchronous handler,
 * we deliberately let per-event errors propagate instead of swallowing them
 * with try/catch, except where we intentionally skip (e.g. reply loops).
 */
async function processWebhookJob(job) {
  const { entry, objectType } = job.data;
  const events = normalizeMetaEvent(entry, objectType);

  for (const event of events) {
    console.log('[webhook-worker] Processing normalized event:', event);

    if (event.type === 'message') {
      await handleIncomingMessage(entry.id, event);
    }

    if (event.type === 'comment') {
      await handleIncomingComment(entry.id, event);
    }
  }
}

let worker = null;

function startWebhookWorker() {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processWebhookJob, {
    connection,
    concurrency: CONCURRENCY,
  });

  worker.on('completed', (job) => {
    console.log(`[webhook-worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[webhook-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  console.log(`[webhook-worker] Worker started for queue "${QUEUE_NAME}" (concurrency: ${CONCURRENCY}).`);
  return worker;
}

module.exports = { startWebhookWorker, processWebhookJob };
