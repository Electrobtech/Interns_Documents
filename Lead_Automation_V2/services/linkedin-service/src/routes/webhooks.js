import express from 'express';
import crypto from 'crypto';
import pool from '../db/client.js';

const router = express.Router();

// POST /webhooks/linkedin/leads - LinkedIn lead webhook
router.post('/webhooks/linkedin/leads', async (req, res) => {
  try {
    const signature = req.headers['x-li-signature'];
    const webhookSecret = process.env.LINKEDIN_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return res.status(401).json({ error: 'Missing signature or secret' });
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(JSON.stringify(req.body));
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { leadGenFormResponse } = req.body;
    const { leadGenFormUrn, leadId, submittedAt, formResponse } = leadGenFormResponse;

    // Check for duplicate
    const existing = await pool.query(
      'SELECT id FROM linkedin_leads WHERE linkedin_lead_id = $1',
      [leadId]
    );

    if (existing.rows.length > 0) {
      return res.json({ status: 'duplicate' });
    }

    // Insert lead
    await pool.query(
      `INSERT INTO linkedin_leads (linkedin_lead_id, form_urn, submitted_at, form_response, status)
       VALUES ($1, $2, $3, $4, 'received')`,
      [leadId, leadGenFormUrn, new Date(submittedAt), JSON.stringify(formResponse)]
    );

    // Create approval for lead batch
    await pool.query(
      `INSERT INTO linkedin_approvals (user_id, type, title, detail, status, payload_preview)
       VALUES ($1, 'lead_batch', $2, $3, 'pending', $4)`,
      ['default_user', 'New lead received from LinkedIn', `Form: ${leadGenFormUrn}`, JSON.stringify({ lead_id: leadId, form_urn: leadGenFormUrn })]
    );

    res.json({ status: 'received' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
