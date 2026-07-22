import express from 'express';
import pool from '../db/client.js';

const router = express.Router();

// GET /campaigns - List campaigns
router.get('/campaigns', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM linkedin_campaigns WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user?.id || 'default_user']
    );

    const campaigns = result.rows.map(camp => ({
      campaign_urn: camp.campaign_urn,
      name: camp.name,
      sync_status: camp.sync_status,
      last_synced_at: camp.last_synced_at,
      spend_to_date_cents: camp.spend_to_date_cents,
      error_code: camp.error_code,
      error_detail: camp.error_detail
    }));

    res.json({ campaigns });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /campaigns/metrics - Get campaign metrics
router.get('/campaigns/metrics', async (req, res) => {
  try {
    const { from, to, campaign_urn } = req.query;

    let query = 'SELECT * FROM linkedin_campaign_metrics WHERE user_id = $1';
    const params = [req.user?.id || 'default_user'];
    let paramIndex = 2;

    if (from) {
      query += ` AND date >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND date <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    if (campaign_urn) {
      query += ` AND campaign_urn = $${paramIndex}`;
      params.push(campaign_urn);
      paramIndex++;
    }

    query += ' ORDER BY date ASC';

    const result = await pool.query(query, params);

    // Calculate summary
    const summary = {
      impressions: 0,
      clicks: 0,
      ctr: 0,
      spend_cents: 0,
      leads: 0
    };

    const daily = result.rows.map(row => {
      summary.impressions += row.impressions || 0;
      summary.clicks += row.clicks || 0;
      summary.spend_cents += row.spend_cents || 0;
      summary.leads += row.leads || 0;

      return {
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr
      };
    });

    summary.ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions * 100).toFixed(2) : 0;

    res.json({ summary, daily });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch campaign metrics' });
  }
});

export default router;
