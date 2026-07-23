/**
 * src/controllers/webhookController.js
 *
 * Handles Gmail's push notification path: Cloud Pub/Sub delivers a push
 * message here whenever gmailApi.watch() has something new for a mailbox
 * (see services/watchJob.js). Push messages only ever say "something
 * changed, as of this historyId" — the actual new message(s) still have
 * to be fetched via users.history.list, which is exactly what
 * syncService.incrementalSync() does.
 *
 * MULTI-TENANCY: same shape as integration-service's webhook — the
 * payload identifies the mailbox by its own address (Gmail's
 * `emailAddress` field), not by organizationId, so the owning account row
 * (and its organization) is resolved via a lookup rather than a JWT.
 *
 * VERIFICATION: Pub/Sub push subscriptions can be configured with an OIDC
 * bearer token that Google signs on every push, which is the fully robust
 * way to verify a request actually came from Pub/Sub. Verifying that
 * signature needs Google's public certs (google-auth-library), which is
 * a heavier dependency than this service otherwise needs. As a pragmatic
 * middle ground — and because Cloud Pub/Sub also lets you pick the push
 * endpoint URL yourself — this checks a shared secret token appended to
 * the push endpoint's own URL (GMAIL_PUBSUB_VERIFY_TOKEN, configured once
 * when creating the Pub/Sub subscription: .../webhook/gmail?token=...).
 * Anyone deploying with a public Pub/Sub topic should upgrade to full OIDC
 * verification before going to production.
 */

const { pool, withTenantScope, withSystemAccess } = require('@lead/shared');
const { incrementalSync } = require('../services/syncService');

function isValidToken(req) {
  const expected = process.env.GMAIL_PUBSUB_VERIFY_TOKEN;
  if (!expected) return true; // not configured — accept, but this should always be set in production
  return req.query.token === expected;
}

/**
 * POST /webhook/gmail
 * Body (Pub/Sub push envelope): { message: { data: <base64 JSON>, messageId, publishTime }, subscription }
 * decoded `data` is: { emailAddress, historyId }
 */
async function receivePush(req, res) {
  // Ack immediately — Pub/Sub retries (with backoff, eventually giving up)
  // on anything other than a 2xx, so a slow downstream sync must never
  // hold up the response.
  res.sendStatus(200);

  if (!isValidToken(req)) {
    console.warn('[email-webhook] Rejected push with invalid/missing verify token.');
    return;
  }

  try {
    const raw = req.body?.message?.data;
    if (!raw) return;

    const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    const { emailAddress } = decoded;
    if (!emailAddress) return;

    // Scans across every organization's mailboxes by the address Gmail
    // itself sent us, so — like integration-service's
    // getCredentialsByMetaId — this runs under withSystemAccess (see
    // infra/db/rls.sql) rather than a tenant-scoped one; there's no
    // organizationId to scope by until after this lookup, and without
    // withSystemAccess, RLS would fail this query closed to zero rows.
    const { rows } = await withSystemAccess(() => pool.query(
      `SELECT id, organization_id FROM email_accounts WHERE email=$1 AND connected=true LIMIT 1`,
      [emailAddress]
    ));
    const account = rows[0];
    if (!account) {
      console.warn(`[email-webhook] Push for unknown/disconnected mailbox: ${emailAddress}`);
      return;
    }

    await withTenantScope(account.organization_id, () => incrementalSync(account.id));
  } catch (err) {
    console.error('[email-webhook] Failed to process push notification:', err);
  }
}

module.exports = { receivePush };
