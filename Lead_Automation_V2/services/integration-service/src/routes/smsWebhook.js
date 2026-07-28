/**
 * src/routes/smsWebhook.js
 *
 * Public, unauthenticated route the third-party SMS-forwarding app on a
 * business's phone POSTs (or GETs — some forwarder apps only support GET)
 * to whenever it sees an incoming text. Mount BEFORE the JSON/authenticate
 * middleware, same as routes/webhook.js (Meta) and email-service's
 * routes/webhook.js (Gmail).
 *
 * Mount in index.js with: app.use('/webhook/sms', require('./routes/smsWebhook'))
 */

const express = require('express');
const router = express.Router();
const { findDeviceByToken, handleInboundSms } = require('../services/smsForwarderService');

async function handle(req, res) {
  // Always ack 200 — forwarder apps typically treat any non-2xx as
  // "delivery failed" and retry indefinitely, which doesn't help once the
  // payload shape is the actual problem. The raw payload is preserved via
  // sms_devices.last_raw_payload for debugging instead.
  res.sendStatus(200);

  try {
    const device = await findDeviceByToken(req.params.token);
    if (!device) {
      console.warn('[sms-webhook] Unknown webhook token.');
      return;
    }
    await handleInboundSms(device, req.body, req.query);
  } catch (err) {
    console.error('[sms-webhook] Failed to process inbound SMS:', err);
  }
}

router.post('/:token', express.json(), express.urlencoded({ extended: true }), handle);
router.get('/:token', handle);

module.exports = router;
