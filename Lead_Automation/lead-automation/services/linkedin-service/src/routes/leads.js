import express from 'express';
import axios from 'axios';
import pool from '../db/client.js';

const router = express.Router();

// GET /leads/forms - List lead gen forms
router.get('/leads/forms', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM linkedin_lead_forms WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user?.id || 'default_user']
    );

    const forms = result.rows.map(form => ({
      form_urn: form.form_urn,
      name: form.name,
      new_lead_count: form.new_lead_count,
      last_synced_at: form.last_synced_at,
      status: form.sync_status,
      auto_approve: form.auto_approve
    }));

    res.json({ forms });
  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ error: 'Failed to fetch lead forms' });
  }
});

// POST /leads/forms/:form_urn/auto_approve - Toggle auto-approve
router.post('/leads/forms/:form_urn/auto_approve', async (req, res) => {
  try {
    const { form_urn } = req.params;
    const { enabled } = req.body;

    await pool.query(
      'UPDATE linkedin_lead_forms SET auto_approve = $1 WHERE form_urn = $2 AND user_id = $3',
      [enabled, form_urn, req.user?.id || 'default_user']
    );

    res.json({ form_urn, auto_approve: enabled });
  } catch (error) {
    console.error('Auto-approve error:', error);
    res.status(500).json({ error: 'Failed to update auto-approve setting' });
  }
});

// GET /leads/reconcile - Pull fallback (internal, cron-triggered)
router.get('/leads/reconcile', async (req, res) => {
  try {
    // This would be called by a cron job to fetch any missed leads
    // Implementation would call LinkedIn's Lead Gen Form API
    res.json({ message: 'Reconciliation job queued' });
  } catch (error) {
    console.error('Reconcile error:', error);
    res.status(500).json({ error: 'Failed to reconcile leads' });
  }
});

export default router;
