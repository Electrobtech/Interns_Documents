const express = require('express');
const router = express.Router();
const { withTenantScope } = require('@lead/shared');
const { evaluateWorkflowStep } = require('../services/workflowEngine');
const playbookRepository = require('../repositories/playbookRepository');
const conversationSessionRepository = require('../repositories/conversationSessionRepository');
const conversationLinkRepository = require('../repositories/conversationLinkRepository');
const messageRepository = require('../repositories/messageRepository');
const complianceGuard = require('../services/complianceGuard');
const { sendWhatsAppMessage } = require('../services/whatsappSender');
const { sendInstagramMessage } = require('../services/instagramSender');

const SENDERS = {
  whatsapp: sendWhatsAppMessage,
  instagram: sendInstagramMessage,
  // messenger shares the Graph API wire format with Instagram, but has its
  // own Page/token setup — wire it here once that's configured.
};
 
/**
 * Normalizes each channel's wildly different webhook shape into one
 * common inboundEvent shape the engine understands. This is the ONLY
 * place channel-specific parsing lives — the engine itself is channel-agnostic.
 */
function normalizeWhatsApp(body) {
  const entry = body.entry?.[0]?.changes?.[0]?.value;
  const msg = entry?.messages?.[0];
  if (!msg) return null;
 
  let interaction = { type: 'text', text: msg.text?.body };
  if (msg.interactive?.type === 'button_reply') {
    interaction = { type: 'button_click', selectedId: msg.interactive.button_reply.id };
  } else if (msg.interactive?.type === 'list_reply') {
    interaction = { type: 'list_select', selectedId: msg.interactive.list_reply.id };
  }
 
  return { channel: 'whatsapp', contactExternalId: msg.from, interaction };
}
 
function normalizeInstagramOrMessenger(body, channel) {
  const messaging = body.entry?.[0]?.messaging?.[0];
  if (!messaging) return null;
 
  let interaction = { type: 'text', text: messaging.message?.text };
  if (messaging.postback?.payload) {
    interaction = { type: 'button_click', selectedId: messaging.postback.payload };
  }
 
  return { channel, contactExternalId: messaging.sender?.id, interaction };
}
 
function normalizeGoogleReview(body) {
  return {
    channel: 'google_reviews',
    contactExternalId: body.reviewId,
    interaction: { type: 'text', text: body.comment }
  };
}
 
function normalizeLinkedInComment(body) {
  return {
    channel: 'linkedin_comments',
    contactExternalId: body.actorUrn,
    interaction: { type: 'text', text: body.commentText }
  };
}
 
const NORMALIZERS = {
  whatsapp: normalizeWhatsApp,
  instagram: (b) => normalizeInstagramOrMessenger(b, 'instagram'),
  messenger: (b) => normalizeInstagramOrMessenger(b, 'messenger'),
  google_reviews: normalizeGoogleReview,
  linkedin_comments: normalizeLinkedInComment
};
 
/**
 * Resolves which active playbook should handle this contact/channel,
 * mirroring the reference builder's playbook roles (Default / Fallback /
 * Transfer / Unsubscribe / GEN AI Default):
 *
 *   1. Opt-out keyword in free text -> the channel's `unsubscribe` playbook, always wins.
 *   2. Contact already has an active session -> keep using that playbook (mid-flow).
 *   3. Free-text message matches a `standard` playbook's triggerKeywords -> start it fresh.
 *   4. Nothing matched -> the channel's `default` playbook (first-touch welcome bot).
 *   5. If even that's missing -> `fallback` playbook, then `gen_ai_default` as last resort.
 */
async function resolvePlaybook({ clientId, channel, contactExternalId, interaction }) {
  const text = (interaction?.text || '').toLowerCase().trim();

  if (['stop', 'unsubscribe', 'opt out'].includes(text)) {
    const unsub = await playbookRepository.findActiveByRole({ clientId, channel, playbookType: 'unsubscribe' });
    if (unsub) return unsub;
  }

  const existingSession = await conversationSessionRepository.findActiveByChannelAndContact({ clientId, channel, contactExternalId });
  if (existingSession) {
    const active = await playbookRepository.findActiveById(existingSession.playbookId);
    if (active) return active;
  }

  if (text) {
    const candidates = await playbookRepository.findActiveStandardCandidates({ clientId, channel });
    const triggered = candidates.find(pb => (pb.triggerKeywords || []).some(kw => text.includes(kw.toLowerCase())));
    if (triggered) return triggered;
  }

  const defaultPb = await playbookRepository.findActiveByRole({ clientId, channel, playbookType: 'default' });
  if (defaultPb) return defaultPb;

  const fallbackPb = await playbookRepository.findActiveByRole({ clientId, channel, playbookType: 'fallback' });
  if (fallbackPb) return fallbackPb;

  return playbookRepository.findActiveByRole({ clientId, channel, playbookType: 'gen_ai_default' });
}
 
// GET /automation/webhooks/:clientId/:channel
// Meta's webhook verification handshake (run once when you register the
// callback URL in the Developer Portal, and again any time you re-save it).
// Works for any channel by looking up `${CHANNEL}_VERIFY_TOKEN` from env, so
// WhatsApp and Instagram share this one handler instead of needing two.
router.get('/automation/webhooks/:clientId/:channel', (req, res) => {
  const { channel } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env[`${channel.toUpperCase()}_VERIFY_TOKEN`];

  if (mode === 'subscribe' && expectedToken && token === expectedToken) {
    console.log(`[webhookController] verified ${channel} webhook for client ${req.params.clientId}`);
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/**
 * The actual engine turn: resolve/open the conversation, log the inbound
 * side, defer to a human if one already owns the conversation, resolve a
 * playbook, evaluate one workflow step, and — unless the step was denied by
 * a limit — actually deliver + transcript-log every resulting template.
 *
 * Extracted out of the route handler below so any caller that already has a
 * normalized { channel, contactExternalId, interaction } can drive a real
 * engine turn exactly as a live Meta webhook would, without going through
 * an HTTP round-trip or reimplementing this logic — see
 * inboxReplyController.js, which uses this to let the Unified Inbox "act as
 * the customer" for demo/testing by clicking a bot message's options.
 *
 * Returns a plain result object rather than writing to `res` directly, so
 * every caller (this file's route included) maps it to its own response.
 * `notFound: true` signals the one case that isn't a 200 — no active
 * playbook for this client/channel/interaction.
 */
async function processInboundEvent({ clientId, channel, contactExternalId, interaction, pinnedConversationId, awaitDelivery = false }) {
  // Resolve (or create) the CRM-facing contact/conversation this event
  // belongs to, and defer to a human agent if one already owns this
  // conversation — e.g. because a prior turn hit a Handoff node, or an
  // agent manually took it over from the inbox. The bot stays completely
  // silent in that case; it does not touch the flow engine at all, so it
  // can't talk over a human who's mid-reply.
  //
  // `pinnedConversationId` is set when this call originated from the
  // Unified Inbox's "Customer (simulate)" send (see inboxReplyController.js)
  // — the CRM already knows exactly which conversation the user is looking
  // at, so this skips resolveConversation()'s "most recently active open
  // conversation for this contact/channel" lookup, which can otherwise land
  // on a DIFFERENT conversation than the one on screen if this contact has
  // more than one open conversation on the same channel (e.g. duplicate
  // seed rows, or a contact who has messaged in more than once). A real
  // inbound webhook has no such pin — it always falls back to the
  // most-recent-open lookup, same as before.
  const conversation = pinnedConversationId
    ? await conversationLinkRepository.resolveConversationById({ conversationId: pinnedConversationId, organizationId: clientId })
    : await conversationLinkRepository.resolveConversation({ organizationId: clientId, channel, externalId: contactExternalId });

  if (!conversation) {
    return { notFound: true, error: 'Conversation not found' };
  }

  // Log the inbound message to the CRM transcript regardless of who
  // currently owns replying — a human agent taking over manually still
  // needs to see what the customer just said. messageRepository swallows
  // its own errors, so this can never throw or slow down the ack below.
  await messageRepository.logInbound({
    organizationId: clientId,
    conversationId: conversation.id,
    contactExternalId,
    interaction,
  });

  if (conversation.handled_by === 'human') {
    return { status: 'human_handled', conversationId: conversation.id };
  }

  // Meta compliance: once a contact has opted out (see the STOP-detection
  // + complianceGuard.recordOptOut() call further down), the bot must not
  // reply at all — not even via the unsubscribe playbook again, since
  // they've already been confirmed unsubscribed once. The inbound message
  // is still logged above so a human can see it if they message back for
  // an unrelated reason.
  if (await complianceGuard.isContactOptedOut(conversation.contact_id)) {
    return { status: 'opted_out', conversationId: conversation.id };
  }

  const playbook = await resolvePlaybook({ clientId, channel, contactExternalId, interaction });
  if (!playbook) {
    return { notFound: true, error: 'No active playbook for this client/channel' };
  }

  const result = await evaluateWorkflowStep({
    clientId,
    channel,
    contactExternalId,
    playbookId: playbook.id,
    interaction
  });

  // Render EVERY queued node (e.g. an auto-chained Text + Document pair),
  // not just the last one, so the send worker fires them in order.
  const templates = (result.nodesToRender || [])
    .map(node => buildSendTemplate(node, channel))
    .filter(Boolean);

  // A handoff node has no real customer-facing message — buildSendTemplate()
  // returns { type: 'handoff', team } for it, which is NOT a Cloud-API-shaped
  // payload. Split those out so they never reach the actual Send API (they
  // used to fall straight into the sender loop below, which whatsappSender's
  // normalizeTemplate() then silently turned into a text message with an
  // empty body — a real outbound API call Meta would just reject). Handoff
  // still gets a transcript entry, just as a system-style note instead.
  const sendableTemplates = templates.filter(t => t.type !== 'handoff');
  const handoffTemplates = templates.filter(t => t.type === 'handoff');

  // Actually deliver the templates to the real contact. This used to just
  // compute `templates` and hand them back in the HTTP response — but
  // Meta doesn't read your webhook's response body, it just wants a fast
  // 200. Nothing was ever reaching the customer's WhatsApp/Instagram app.
  // Fired without awaiting (and each wrapped in its own catch) so:
  //   (a) Meta gets its ack quickly regardless of the provider's latency, and
  //   (b) one template failing to send doesn't stop the rest of the queue.
  const sender = SENDERS[channel];
  if (sender && !result.denied) {
    for (const template of sendableTemplates) {
      // 24-hour customer service window check — see complianceGuard.js.
      // In practice this is nearly always satisfied for a live webhook
      // turn (the customer's own message that triggered this turn is
      // itself the most recent inbound message, so the window just
      // opened), but it's checked here too — rather than only in
      // campaignSendController.js — so a future delayed/scheduled node
      // (e.g. a "wait 2 days then follow up" step) can't silently attempt
      // a free-form send Meta would reject anyway.
      const check = await complianceGuard.checkSendAllowed({
        contactId: conversation.contact_id,
        conversationId: conversation.id,
        template,
      });
      if (!check.allowed) {
        console.warn(`[webhookController] blocked ${channel} send to ${contactExternalId}: ${check.reason}`);
        messageRepository.logSystem({
          organizationId: clientId,
          conversationId: conversation.id,
          body: `Automated reply blocked: ${check.reason}`,
          metadata: { code: check.code, template },
        });
        continue;
      }

      sender(contactExternalId, template).catch((err) => {
        console.error(`[webhookController] failed to deliver ${channel} message to ${contactExternalId}:`, err.message);
      });
      // Logged alongside the send, not after it resolves — mirrors the
      // "assume delivery succeeded, log failures via the .catch above"
      // pattern the sender loop already uses, and keeps this off the
      // ack's critical path for a REAL inbound webhook (Meta only cares
      // about a fast ack, not this write completing).
      //
      // BUT: when this turn was triggered from the Unified Inbox's
      // "Customer (simulate)" send (awaitDelivery=true — see
      // inboxReplyController.js), there's no webhook ack deadline to
      // protect, and the CRM's own UI calls load() the instant this HTTP
      // response comes back. Firing this without awaiting meant that
      // reload could easily race the write and come back empty — the bot's
      // reply was really being saved, just a few hundred ms after the
      // person had already stopped looking for it, so it only ever showed
      // up on some later, unrelated reload. Awaiting it here for that one
      // caller closes that race, at the cost of a slightly slower response
      // to a purely-internal, non-webhook call — a trade worth making.
      const logPromise = messageRepository.logOutbound({
        organizationId: clientId,
        conversationId: conversation.id,
        template,
      });
      if (awaitDelivery) await logPromise;
    }
  }

  // Meta compliance: persist the opt-out AFTER this turn's reply (the
  // unsubscribe playbook's confirmation message) has already been allowed
  // to send above — the contact is still owed that one confirmation.
  // Everything from here on (the next inbound turn's short-circuit above,
  // and every campaign broadcast — see campaignSendController.js) is
  // blocked once this is set.
  if (complianceGuard.isOptOutText(interaction?.text)) {
    await complianceGuard.recordOptOut({ contactId: conversation.contact_id });
  }

  // A Handoff node ends the flow's turn AND ends the bot's ownership of
  // the conversation — flip it to human (and, via setHandledBy, nudge
  // status to 'pending') so it surfaces in the inbox as needing a reply,
  // with the toggle already reflecting who's responsible. Also drop a
  // system-style line in the transcript so an agent opening the
  // conversation can see *why* the bot stopped, not just that it did.
  if (result.terminal && result.nodeToRender?.type === 'handoff') {
    await conversationLinkRepository.setHandledBy({ conversationId: conversation.id, handledBy: 'human' });
    for (const handoffTemplate of handoffTemplates) {
      messageRepository.logSystem({
        organizationId: clientId,
        conversationId: conversation.id,
        body: `Conversation handed off to ${handoffTemplate.team || 'a human agent'}.`,
        metadata: handoffTemplate,
      });
    }
  }

  if (result.denied) {
    return {
      status: 'limit_reached',
      limitInfo: result.denied,
      templates,
      conversationId: conversation.id,
    };
  }

  return {
    status: result.terminal ? 'terminal' : 'active',
    sessionId: result.session?.id,
    conversationId: conversation.id,
    templates
  };
}

// POST /automation/webhooks/:clientId/:channel
// Note: mounted under /automation (not the bare /webhooks the CRM's own
// integration-service already owns for outbound webhook subscriptions) so the
// two never collide at the api-gateway. This is the public, unauthenticated
// endpoint external channel providers (Meta, etc.) call directly.
router.post('/automation/webhooks/:clientId/:channel', async (req, res) => {
  const { clientId, channel } = req.params;

  try {
    const normalizer = NORMALIZERS[channel];
    if (!normalizer) return res.status(400).json({ error: `Unsupported channel: ${channel}` });

    const parsed = normalizer(req.body);
    if (!parsed) return res.status(200).json({ ok: true }); // non-message webhook noise (delivery receipts etc.)

    // This route is deliberately unauthenticated (Meta can't send a CRM
    // bearer token), so the `authenticate` middleware never runs and never
    // sets app.current_org the way it does for every other route — without
    // this, every write below fails RLS's WITH CHECK (see infra/db/rls.sql)
    // since app_current_org() is NULL. clientId is already the org id
    // straight from the verified webhook URL, so scope to it explicitly.
    const result = await withTenantScope(clientId, () => processInboundEvent({
      clientId, channel, contactExternalId: parsed.contactExternalId, interaction: parsed.interaction
    }));

    if (result.notFound) return res.status(404).json({ error: result.error });

    return res.status(200).json(result);

  } catch (err) {
    console.error('[webhookController] error:', err);
    return res.status(500).json({ error: 'Internal engine error' });
  }
});
 
/**
 * Converts an internal message node into the channel-specific payload shape
 * ready to hand to the actual Send API (WhatsApp Cloud API / IG Graph API / etc).
 * Kept separate from the engine so the engine never needs to know channel wire formats.
 */
function buildSendTemplate(node, channel) {
  if (node.type === 'handoff') {
    return { type: 'handoff', team: node.data.team };
  }
 
  const { messageType, body, buttons, list, document, header, footer } = node.data;
 
  if (channel === 'whatsapp') {
    if (messageType === 'buttons') {
      const safeButtons = buttons || [];
      return {
        type: 'interactive',
        interactive: {
          type: 'button',
          header: header ? { type: header.type, text: header.text } : undefined,
          body: { text: body },
          footer: footer ? { text: footer } : undefined,
          action: { buttons: safeButtons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.label } })) }
        }
      };
    }
    if (messageType === 'list') {
      // Defensive: `list` should always be populated by exportFlowJson now
      // (see FlowBuilder.jsx), but this guards against any playbook saved
      // before that fix, or hand-edited JSON, from crashing the entire
      // engine turn (and silently dropping the reply — see the big comment
      // on the sender loop below) the way a bare `list.buttonLabel` access
      // on `undefined` used to.
      const safeList = list || { buttonLabel: 'Options', sections: [] };
      return {
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: { button: safeList.buttonLabel || 'Options', sections: safeList.sections || [] }
        }
      };
    }
    if (messageType === 'document') {
      return { type: 'document', document: { link: document.url, filename: document.filename }, caption: body };
    }
    return { type: 'text', text: { body } };
  }
 
  // Generic fallback shape for Instagram/Messenger/etc (Graph API quick_replies use a similar shape)
  return { type: messageType, body, buttons, list, document };
}
 
module.exports = router;
// Attached rather than replacing the export — `router` is still what
// index.js mounts as Express middleware (`app.use('/', webhookController)`);
// this just also exposes the reusable engine-turn function for
// inboxReplyController.js (see the big comment above its definition).
module.exports.processInboundEvent = processInboundEvent;