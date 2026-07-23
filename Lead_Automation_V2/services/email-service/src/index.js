require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { authenticate } = require('@lead/shared');

const webhookRoutes = require('./routes/webhook');
const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const threadsRoutes = require('./routes/threads');
const messagesRoutes = require('./routes/messages');
const attachmentsRoutes = require('./routes/attachments');

const { startWatchRenewalScheduler } = require('./services/watchJob');
const { startPollWorker } = require('./services/pollWorker');

const app = express();
app.use(cors());

// Gmail's Pub/Sub push notification. Public/unauthenticated (Google calls
// this directly — see webhookController.js for how it's verified instead
// of via a JWT), so it's mounted before express.json()/authenticate below,
// same placement as integration-service's Meta webhook.
app.use('/webhook', webhookRoutes);

app.use(express.json());

// Serve locally-cached attachment bytes (both freshly-downloaded inbound
// Gmail attachments and outgoing ones the user attached when composing —
// see services/attachmentStorage.js). Deliberately public/unauthenticated,
// same as automation-service's and auth-service's /uploads — a random
// filename is the access control, not a session check.
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Google's OAuth redirect lands here directly from the browser, so it
// can't carry our Authorization header — must be mounted before
// app.use(authenticate) below. Every other /email/auth/* route still
// requires a valid JWT (see routes/auth.js's `router` export).
app.use(authRoutes.publicRouter);

app.get('/health', (_req, res) => res.json({ service: 'email', ok: true }));

// Everything below requires a valid JWT, giving req.user.organizationId
// (and, via shared/src/auth.js's authenticate middleware, a tenant-scoped
// DB connection for the rest of the request — see infra/db/rls.sql).
app.use(authenticate);

app.use('/email/auth', authRoutes.router);
app.use('/email/accounts', accountsRoutes);
app.use('/email/threads', threadsRoutes);
app.use('/email/messages', messagesRoutes);
app.use('/email/attachments', attachmentsRoutes);

const PORT = process.env.EMAIL_PORT || 4013;
app.listen(PORT, () => {
  console.log(`email-service on :${PORT}`);
  startWatchRenewalScheduler();
  startPollWorker();
});
