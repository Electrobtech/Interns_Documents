require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { authenticate } = require('@lead/shared');

// Import existing routes
const { buildRouter } = require('./routes/campaignsRouter');
const audiencesRouter = require('./routes/audiencesRouter');
const channelsRouter = require('./routes/channelsRouter');

// Import new routes
const contentRoutes = require('./routes/content');
const analyticsRoutes = require('./routes/analytics');
const assetsRoutes = require('./routes/assets');
const templatesRoutes = require('./routes/templates');
const seoRoutes = require('./routes/seo');
const aeoRoutes = require('./routes/aeo');
const competitorsRoutes = require('./routes/competitors');
const calendarRoutes = require('./routes/calendar');
const knowledgeRoutes = require('./routes/knowledge');
const settingsRoutes = require('./routes/settings');

const { startMhWorker, attachIo } = require('./services/mhWorker');
const { attachRealtime } = require('./realtime');

const app = express();
app.use(cors());
app.use(express.json({ limit: '300mb' }));
app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'marketing-hub', ok: true }));

// Existing routes
app.use('/campaigns', buildRouter('campaign'));
app.use('/broadcasts', buildRouter('broadcast'));
app.use('/audiences', audiencesRouter);
app.use('/channels', channelsRouter);

// New feature routes
app.use('/content', contentRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/assets', assetsRoutes);
app.use('/templates', templatesRoutes);
app.use('/seo', seoRoutes);
app.use('/aeo', aeoRoutes);
app.use('/competitors', competitorsRoutes);
app.use('/calendar', calendarRoutes);
app.use('/knowledge', knowledgeRoutes);
app.use('/settings', settingsRoutes);

// FIX: Express 4 does not automatically catch a rejected promise thrown
// inside an async route handler — see campaign-service/src/index.js's own
// identical comment for the incident this pattern prevents. Every route
// here is wrapped in `ah()`, which forwards to this handler instead of
// crashing the whole process on one bad request.
app.use((err, req, res, _next) => {
  console.error('[marketing-hub-service] unhandled route error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.MARKETING_HUB_PORT || 4016;
const server = http.createServer(app);
const io = attachRealtime(server);
attachIo(io);

server.listen(PORT, () => {
  console.log(`marketing-hub-service on :${PORT}`);
  startMhWorker();
});
