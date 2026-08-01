import express from 'express';
import pool from '../db/client.js';
import loadConnection from '../lib/loadConnection.js';
import { linkedinClient, callLinkedIn } from '../lib/linkedinApi.js';

const router = express.Router();

// POST /campaigns — launch a LinkedIn ad campaign. Requires the LinkedIn
// Advertising API (rw_ads), which is only granted after LinkedIn's Marketing
// Developer Platform partner review — there is no self-serve path for this,
// so this 403s with a clear reason on any account without partner access,
// rather than silently failing against LinkedIn or faking success.
router.post('/campaigns', loadConnection, async (req, res) => {
  const granted = req.linkedinConnection.granted_scopes || [];
  if (!granted.includes('rw_ads')) {
    return res.status(403).json({
      error: 'linkedin_partner_access_required',
      scope: 'rw_ads',
      message: 'Launching LinkedIn ad campaigns needs Marketing Developer Platform approval for the "rw_ads" scope. Apply for partner access, then reconnect LinkedIn.',
    });
  }

  const { name, ad_account_urn, daily_budget_cents, objective } = req.body;
  if (!name || !ad_account_urn) {
    return res.status(400).json({ error: 'name and ad_account_urn are required' });
  }

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.post('/rest/adCampaigns', {
    account: ad_account_urn,
    name,
    status: 'DRAFT',
    type: 'SPONSORED_UPDATES',
    objectiveType: objective || 'WEBSITE_VISIT',
    costType: 'CPC',
    dailyBudget: daily_budget_cents ? { amount: String(daily_budget_cents / 100), currencyCode: 'USD' } : undefined,
  }));

  if (!result.ok) {
    return res.status(result.status).json({ error: 'linkedin_campaign_create_failed', detail: result.body });
  }

  const campaignUrn = result.data?.id || result.headers?.['x-restli-id'];
  const { rows } = await pool.query(`
    INSERT INTO linkedin_campaigns (user_id, campaign_urn, name, sync_status)
    VALUES ($1, $2, $3, 'synced')
    ON CONFLICT (user_id, campaign_urn) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `, [req.user?.id || 'default_user', campaignUrn, name]);

  res.status(201).json(rows[0]);
});

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
