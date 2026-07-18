import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import pool from '../db/client.js';

const router = express.Router();

// LinkedIn OAuth configuration
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:4009/api/v1/integrations/linkedin/callback';

const SCOPES = [
  'r_liteprofile',
  'r_organization_admin',
  'r_ads_leadgen_automation',
  'r_ads_reporting',
  'r_organization_social'
];

// POST /connect - Start OAuth flow
router.post('/connect', async (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store state in database
    await pool.query(
      'INSERT INTO oauth_states (state, expires_at) VALUES ($1, $2)',
      [state, expiresAt]
    );

    const scopeParam = SCOPES.join(' ');
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&scope=${encodeURIComponent(scopeParam)}&state=${state}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}`;

    res.json({ authorization_url: authUrl });
  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// GET /callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error === 'access_denied') {
    return res.redirect('/settings/integrations/linkedin?error=access_denied');
  }

  if (!code || !state) {
    return res.redirect('/settings/integrations/linkedin?error=invalid_request');
  }

  try {
    // Validate state
    const stateResult = await pool.query(
      'SELECT expires_at FROM oauth_states WHERE state = $1 AND used = false AND expires_at > NOW()',
      [state]
    );

    if (stateResult.rows.length === 0) {
      return res.redirect('/settings/integrations/linkedin?error=state_mismatch');
    }

    // Mark state as used
    await pool.query('UPDATE oauth_states SET used = true WHERE state = $1', [state]);

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Get user profile
    const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const profile = profileResponse.data;

    // Store connection
    await pool.query(`
      INSERT INTO linkedin_connections 
      (user_id, access_token, refresh_token, expires_at, linkedin_user_id, display_name, granted_scopes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'healthy')
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        display_name = EXCLUDED.display_name,
        granted_scopes = EXCLUDED.granted_scopes,
        status = 'healthy',
        updated_at = NOW()
    `, [req.user?.id || 'default_user', access_token, refresh_token, expiresAt, profile.id, `${profile.localizedFirstName} ${profile.localizedLastName}`, SCOPES]);

    res.redirect('/settings/integrations/linkedin?connected=true');
  } catch (error) {
    console.error('Callback error:', error);
    res.redirect('/settings/integrations/linkedin?error=exchange_failed');
  }
});

// GET /status - Get connection status
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM linkedin_connections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user?.id || 'default_user']
    );

    if (result.rows.length === 0) {
      return res.json({
        status: 'disconnected',
        connection_id: null,
        display_name: null,
        granted_scopes: [],
        scope_status: {}
      });
    }

    const conn = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(conn.expires_at);
    const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    let status = 'healthy';
    if (daysUntilExpiry <= 5) status = 'expiring';
    if (now > expiresAt) status = 'error';

    const grantedScopes = conn.granted_scopes || [];
    const scopeStatus = {
      'r_liteprofile': grantedScopes.includes('r_liteprofile') ? 'granted' : 'not_requested',
      'r_organization_admin': grantedScopes.includes('r_organization_admin') ? 'granted' : 'not_requested',
      'r_ads_leadgen_automation': grantedScopes.includes('r_ads_leadgen_automation') ? 'granted' : 'not_requested',
      'r_ads_reporting': grantedScopes.includes('r_ads_reporting') ? 'granted' : 'not_requested',
      'r_organization_social': grantedScopes.includes('r_organization_social') ? 'granted' : 'not_requested',
      'w_organization_social': 'not_requested',
      'rw_ads': 'not_requested'
    };

    res.json({
      connection_id: conn.id,
      status,
      display_name: conn.display_name,
      linkedin_org_urn: conn.linkedin_org_urn,
      connected_by: { user_id: conn.user_id, name: conn.display_name },
      connected_at: conn.created_at,
      token_expires_at: conn.expires_at,
      granted_scopes: grantedScopes,
      scope_status,
      last_error: conn.last_error
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get connection status' });
  }
});

// POST /reconnect - Reconnect existing connection
router.post('/reconnect', async (req, res) => {
  try {
    // Same as connect - re-runs OAuth flow
    const state = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'INSERT INTO oauth_states (state, expires_at) VALUES ($1, $2)',
      [state, expiresAt]
    );

    const scopeParam = SCOPES.join(' ');
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&scope=${encodeURIComponent(scopeParam)}&state=${state}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}`;

    res.json({ authorization_url: authUrl });
  } catch (error) {
    console.error('Reconnect error:', error);
    res.status(500).json({ error: 'Failed to initiate reconnection' });
  }
});

// DELETE /connection - Disconnect
router.delete('/connection', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM linkedin_connections WHERE user_id = $1',
      [req.user?.id || 'default_user']
    );

    res.json({ status: 'disconnected' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;
