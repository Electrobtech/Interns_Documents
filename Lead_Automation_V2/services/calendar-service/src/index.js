require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { authenticate } = require('@lead/shared');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');

const app = express();
app.use(cors());
app.use(express.json());

// Google's OAuth redirect lands here directly from the browser, so it
// can't carry our Authorization header — must be mounted before
// app.use(authenticate) below. Every other /calendar/* route still
// requires a valid JWT.
app.use(authRoutes.publicRouter);

app.get('/health', (_req, res) => res.json({ service: 'calendar', ok: true }));

// Everything below requires a valid JWT, giving req.user.organizationId
// (and, via shared/src/auth.js's authenticate middleware, a tenant-scoped
// DB connection for the rest of the request — see infra/db/rls.sql).
app.use(authenticate);

app.use('/calendar/auth', authRoutes.router);
app.use('/calendar/events', eventsRoutes);

const PORT = process.env.CALENDAR_PORT || 4014;
app.listen(PORT, () => {
  console.log(`calendar-service on :${PORT}`);
});
