/**
 * src/routes/webhook.js
 *
 * Routes for Meta's webhook system.
 * Mount in index.js with: app.use('/webhook', require('./routes/webhook'))
 *
 * IMPORTANT: signature verification in webhookController needs the RAW
 * request body (not the parsed JSON) to compute the HMAC correctly.
 * The express.json() `verify` option below captures it onto req.rawBody
 * before parsing. If you already call express.json() globally in index.js,
 * make sure it doesn't run again ahead of this route in a way that
 * consumes the stream first.
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.get(
  '/meta',
  webhookController.verify
);

router.post(
  '/meta',
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // needed for X-Hub-Signature-256 verification
    }
  }),
  webhookController.receiveEvent
);

module.exports = router;