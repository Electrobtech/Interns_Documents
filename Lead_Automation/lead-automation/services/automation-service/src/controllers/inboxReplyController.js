const express = require('express');
const router = express.Router();
const { pool } = require('@lead/shared');
const { processInboundEvent } = require('./webhookController');

/**
 * Internal, service-to-service-shaped endpoint — called from the Unified
 * Inbox's conversation view (frontend/src/app/(app)/inbox/[id]/page.jsx),
 * not by an external channel provider. Lets a CRM user click one of a bot
 * message's options (or type a line) directly in the inbox and have it run
 * through the SAME engine turn a real inbound WhatsApp/Instagram webhook
 * would trigger — see processInboundEvent in webhookController.js, which
 * this calls directly rather than re-deriving any of that logic.
 *
 * Deliberately separate from POST /automation/session/simulate: that route
 * is the Playbook Studio's Simulate tab, which talks to the engine with a
 * bare { recipientPhone, playbookId } pair and stays isolated from
 * production message storage on purpose. This route is the opposite â€”
 * it's keyed off a real conversationId and is SUPPOSED to write to the same
 * `messages` transcript a live customer reply would, so what you see in the
 * inbox after clicking an option is exactly what a real contact would see
 * and exactly what gets stored. Gated behind CRM `authenticate` (see
 * index.js) since it's only ever called from the logged-in dashboard.
 */
router.post('/automation/internal/inbox-reply', async (req, res) => {
  const organizationId = req.user.organizationId;
  const { conversationId, interaction } = req.body;

  if (!conversationId || !interaction || !interaction.type) {
    return res.status(400).json({ error: 'conversationId and interaction (with a type) are required' });
  }

  try {
    // automation-service and inbox-service share one Postgres database (see
    // conversationLinkRepository.js for the same reasoning), so this is a
    // plain lookup rather than a call back into inbox-service.
    const { rows } = await pool.query(
      `SELECT c.channel_type, ct.external_id AS contact_external_id
         FROM conversations c
         JOIN contacts ct ON ct.id = c.contact_id
        WHERE c.id = $1 AND c.organization_id = $2`,
      [conversationId, organizationId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Conversation not found' });
    if (!row.contact_external_id) {
      // Contacts created purely in-app (never resolved from an inbound
      // automation webhook) have no channel identity to reply "as" — see
      // the external_id comment on the contacts table in schema.sql.
      return res.status(422).json({ error: 'This contact has no channel identity to simulate a reply from' });
    }

    const result = await processInboundEvent({
      clientId: organizationId,
      channel: row.channel_type,
      contactExternalId: row.contact_external_id,
      interaction,
    });

    if (result.notFound) return res.status(404).json({ error: result.error });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[inboxReplyController] error:', err);
    return res.status(500).json({ error: 'Internal engine error' });
  }
});

module.exports = router;