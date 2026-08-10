const express = require('express');
const cors = require('cors');
const path = require('path');
const { authenticate } = require('@lead/shared');

const assetsRoutes = require('./assets');
const audiencesRoutes = require('./audiences');
const campaignsRoutes = require('./campaigns');
const broadcastsRoutes = require('./broadcasts');
const calendarRoutes = require('./calendar');

const app = express();
app.use(cors());
app.use(express.json());

// Serves uploaded marketing assets at /uploads/marketing-assets/<file>.
// Public/unauthenticated so <img src> and download links from the browser
// (and any future Meta/CDN fetch) work without a CRM bearer token.
// Must be registered BEFORE authenticate so static GETs aren't blocked.
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'public', 'uploads'))
);

app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'marketing-hub', ok: true }));

app.use(assetsRoutes);
app.use(audiencesRoutes);
app.use(campaignsRoutes);
app.use(broadcastsRoutes);
app.use(calendarRoutes);

const PORT = process.env.MARKETING_HUB_PORT || 4016;
app.listen(PORT, () => console.log(`marketing-hub-service on :${PORT}`));
