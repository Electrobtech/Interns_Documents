import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectionRoutes from './routes/connection.js';
import leadRoutes from './routes/leads.js';
import campaignRoutes from './routes/campaigns.js';
import organizationRoutes from './routes/organization.js';
import approvalRoutes from './routes/approvals.js';
import logRoutes from './routes/logs.js';
import webhookRoutes from './routes/webhooks.js';
import postRoutes from './routes/posts.js';
import interactionRoutes from './routes/interactions.js';
import conversionRoutes from './routes/conversions.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4009;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'linkedin-service' });
});

// API routes
app.use('/api/v1/integrations/linkedin', connectionRoutes);
app.use('/api/v1/integrations/linkedin', leadRoutes);
app.use('/api/v1/integrations/linkedin', campaignRoutes);
app.use('/api/v1/integrations/linkedin', organizationRoutes);
app.use('/api/v1/integrations/linkedin', approvalRoutes);
app.use('/api/v1/integrations/linkedin', logRoutes);
app.use('/api/v1/integrations/linkedin', webhookRoutes);
app.use('/api/v1/integrations/linkedin', postRoutes);
app.use('/api/v1/integrations/linkedin', interactionRoutes);
app.use('/api/v1/integrations/linkedin', conversionRoutes);

app.listen(PORT, () => {
  console.log(`LinkedIn service running on port ${PORT}`);
});
