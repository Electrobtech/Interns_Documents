const path = require('path');
const express = require('express');
const path = require('path');
const cors = require('cors');
const { authenticate } = require('@lead/shared');

const productsRoutes = require('./products');
const templatesRoutes = require('./templates');
const templateMediaRoutes = require('./templateMedia');
const { startBulkCampaignWorker } = require('./services/bulkCampaignWorker');

const app = express();
app.use(cors());
app.use(express.json());

// Serves template media uploads at /uploads/templates/<file> (see templateMedia.js).
// Public so Live Preview <img> tags work without a bearer token.
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'campaign', ok: true }));

// Products/offers (campaigns promote these — see products.js header comment)
app.use(productsRoutes);

// Message templates
app.use(templatesRoutes);

// Template media upload (mounted before generic /templates/:id routes above
// so /templates/media/upload isn't swallowed by :id)
app.use(templateMediaRoutes);

// Starts the BullMQ worker that consumes bulk-campaign-recipients jobs
// (see services/bulkCampaignWorker.js / bulkCampaignQueue.js)
startBulkCampaignWorker();

const PORT = process.env.CAMPAIGN_PORT || 4004;
app.listen(PORT, () => console.log(`campaign-service on :${PORT}`));
