/**
 * src/routes/webhook.js
 *
 * Route for Gmail's Cloud Pub/Sub push notifications.
 * Mount in index.js with: app.use('/webhook', require('./routes/webhook'))
 * (before express.json() the way integration-service does for Meta —
 * kept consistent even though this controller doesn't need the raw body
 * for signature verification the way Meta's does; see webhookController.js
 * for how this endpoint is verified instead).
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.post('/gmail', express.json(), webhookController.receivePush);

module.exports = router;
