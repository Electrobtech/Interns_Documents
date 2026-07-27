const express = require('express');
const router = express.Router();
const conversationLinkRepository = require('../repositories/conversationLinkRepository');
const messageRepository = require('../repositories/messageRepository');
const complianceGuard = require('../services/complianceGuard');
const { sendWhatsAppMessage } = require('../services/whatsappSender');
const { sendInstagramMessage } = require('../services/instagramSender');

const SENDERS = {
  whatsapp: sendWhatsAppMessage,
  instagram: sendInstagramMessage,
};

/**
 * Internal, service-to-service endpoint — called by campaign-service's
 * POST /campaigns/:id/send loop, never by the browser directly. Delivers
 * ONE campaign message to ONE contact and logs it, mirroring the outbound
 * half of webhookController: resolve/open the same conversation record a
 * live webhook reply from this contact would land in, actually hit the
 * channel's Send API, then write the result to the Unified Inbox
 * transcript — so a broadcast shows up in Conversations exactly like a bot
 * reply does, instead of only existing as a campaign_logs row.
 *
 * Still gated behind the CRM's own `authenticate` (mounted in index.js) —
 * campaign-service forwards the original user's bearer token rather than
 * this being a public route, same JWT/secret as every other CRM service.
 */
router.post('/automation/internal/campaign-send', async (req, res) => {
  const { channel, externalId, body } = req.body;
  const organizationId = req.user.organizationId;

  const sender = SENDERS[channel];
  if (!sender) {
    return res.status(400).json({ error: `Unsupported channel: ${channel}` });
  }
  if (!externalId || !body) {
    return res.status(400).json({ error: 'externalId and body are required' });
  }

  try {
    // Resolve (or open) the same conversation a live inbound webhook from
    // this contact would resolve to, so a reply to a broadcast threads into
    // the existing conversation instead of forking a parallel one — and so a
    // conversation a human has already taken over still gets the transcript
    // entry (campaigns aren't routed through the bot/human handoff check;
    // this is an explicit send the user asked for, not an automated reply).
    const conversation = await conversationLinkRepository.resolveConversation({
      organizationId, channel, externalId,
    });

    // Meta compliance: a campaign send is a proactive/marketing message —
    // exactly what the opt-out and 24-hour-window rules exist to gate. A
    // plain-text campaign body is never a real pre-approved template (see
    // complianceGuard's TEMPLATE_TYPE note), so both checks apply here in
    // full; nothing in this codebase sends real Meta templates yet, so an
    // out-of-window contact currently can't be reached by a campaign at
    // all — that's a real limitation (not a bug in this check) worth
    // knowing about, see the compliance doc for the template-approval
    // workaround.
    const check = await complianceGuard.checkSendAllowed({
      contactId: conversation.contact_id,
      conversationId: conversation.id,
      template: { type: 'text', text: { body } },
    });
    if (!check.allowed) {
      await messageRepository.logSystem({
        organizationId,
        conversationId: conversation.id,
        body: `Campaign message blocked: ${check.reason}`,
        metadata: { code: check.code },
      });
      return res.status(422).json({ error: check.reason, code: check.code, conversationId: conversation.id });
    }

    try {
      await sender(externalId, body);
    } catch (sendErr) {
      // Delivery failed — still drop a system-style transcript line so an
      // agent opening the conversation can see a broadcast was attempted
      // and why it didn't land, instead of silence. logSystem is fail-soft
      // on its own errors (see messageRepository), so this can't throw.
      await messageRepository.logSystem({
        organizationId,
        conversationId: conversation.id,
        body: `Campaign message failed to send: ${sendErr.message}`,
        metadata: { channel, externalId, error: sendErr.message },
      });
      return res.status(502).json({ error: sendErr.message, conversationId: conversation.id });
    }

    // { type: 'text', text: { body } } matches messageRepository's
    // describeTemplate() 'text' branch regardless of channel, so this reads
    // back correctly in the transcript for both WhatsApp and Instagram
    // sends. Fail-soft: logOutbound swallows its own Postgres errors and
    // resolves to null instead of throwing, so a broken transcript write
    // can never turn a message that *did* send into an error response.
    await messageRepository.logOutbound({
      organizationId,
      conversationId: conversation.id,
      template: { type: 'text', text: { body } },
    });

    return res.status(200).json({ ok: true, conversationId: conversation.id });
  } catch (err) {
    console.error('[campaignSendController] error:', err);
    return res.status(500).json({ error: 'Internal error resolving conversation for campaign send' });
  }
});

module.exports = router;
