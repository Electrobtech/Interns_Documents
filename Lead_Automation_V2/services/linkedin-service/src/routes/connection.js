import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import pool from '../db/client.js';
import { requestedScopes, hasAdsAccess, hasOrgAccess, PARTNER_SCOPES } from '../lib/scopes.js';

const router = express.Router();

// LinkedIn OAuth configuration
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:4009/api/v1/integrations/linkedin/callback';
// Where the browser lands after OAuth. Must be an ABSOLUTE url pointing at
// the frontend (this service has no frontend pages of its own — a relative
// redirect resolves against linkedin-service's own origin and 404s). The
// LinkedIn UI lives under Channels, not Integrations — a dedicated static
// route at /app/channels/linkedin (which overrides the generic
// /app/channels/[type] conversation view for exactly this channel).
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_LINKEDIN_PAGE = `${FRONTEND_URL}/app/channels/linkedin`;

function authUrlFor(state) {
  const scopeParam = requestedScopes().join(' ');
  return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&scope=${encodeURIComponent(scopeParam)}&state=${state}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}`;
}

// POST /connect - Start OAuth flow
router.post('/connect', async (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      'INSERT INTO oauth_states (state, expires_at) VALUES ($1, $2)',
      [state, expiresAt]
    );

    res.json({ authorization_url: authUrlFor(state) });
  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// GET /callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error === 'access_denied') {
    return res.redirect(`${FRONTEND_LINKEDIN_PAGE}?error=access_denied`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND_LINKEDIN_PAGE}?error=invalid_request`);
  }

  try {
    // Validate state
    const stateResult = await pool.query(
      'SELECT expires_at FROM oauth_states WHERE state = $1 AND used = false AND expires_at > NOW()',
      [state]
    );

    if (stateResult.rows.length === 0) {
      return res.redirect(`${FRONTEND_LINKEDIN_PAGE}?error=state_mismatch`);
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

    const { access_token, refresh_token, expires_in, scope: grantedScopeStr } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    // LinkedIn echoes back the space-separated scopes it ACTUALLY granted —
    // trust this over what we requested, since a partner-gated scope we
    // asked for without approval simply won't appear here.
    const grantedScopes = (grantedScopeStr || '').split(/[\s,]+/).filter(Boolean);

    // Identity via OpenID Connect UserInfo — /v2/me + r_liteprofile were
    // retired; this is the current self-serve identity endpoint and works
    // with just the `openid profile` scopes.
    const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const profile = profileResponse.data; // { sub, name, given_name, family_name, email, picture }

    // Company Page URN — only fetchable once Community Management API is
    // approved (rw_organization_admin granted). Non-fatal: if it's not
    // granted yet, or the member isn't an admin of any page, this quietly
    // leaves linkedin_org_urn null rather than failing the whole connect.
    let orgUrn = null;
    if (grantedScopes.includes('rw_organization_admin')) {
      try {
        const aclResp = await axios.get(
          'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
          { headers: { Authorization: `Bearer ${access_token}`, 'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202606' } }
        );
        orgUrn = aclResp.data?.elements?.[0]?.organization || null;
      } catch (aclErr) {
        console.warn('Could not fetch organization ACLs (non-fatal):', aclErr?.response?.data || aclErr.message);
      }
    }

    // Store connection
    await pool.query(`
      INSERT INTO linkedin_connections
      (user_id, access_token, refresh_token, expires_at, linkedin_user_id, linkedin_org_urn, display_name, granted_scopes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'healthy')
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        display_name = EXCLUDED.display_name,
        linkedin_user_id = EXCLUDED.linkedin_user_id,
        linkedin_org_urn = COALESCE(EXCLUDED.linkedin_org_urn, linkedin_connections.linkedin_org_urn),
        granted_scopes = EXCLUDED.granted_scopes,
        status = 'healthy',
        last_error = NULL,
        updated_at = NOW()
    `, [req.user?.id || 'default_user', access_token, refresh_token, expiresAt, profile.sub, orgUrn, profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim(), grantedScopes]);

    res.redirect(`${FRONTEND_LINKEDIN_PAGE}?connected=true`);
  } catch (error) {
    console.error('Callback error:', error?.response?.data || error);
    res.redirect(`${FRONTEND_LINKEDIN_PAGE}?error=exchange_failed`);
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
        scope_status: {},
        ads_access_configured: hasAdsAccess(),
        org_access_configured: hasOrgAccess(),
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
    // Every scope we know about (core + partner), each marked granted or not
    // — so the UI can show exactly what's live vs. still needs partner review.
    const scopeStatus = {};
    for (const s of [...['openid', 'profile', 'email', 'w_member_social'], ...PARTNER_SCOPES]) {
      scopeStatus[s] = grantedScopes.includes(s) ? 'granted' : (PARTNER_SCOPES.includes(s) ? 'needs_partner_approval' : 'not_requested');
    }

    res.json({
      connection_id: conn.id,
      status,
      display_name: conn.display_name,
      linkedin_org_urn: conn.linkedin_org_urn,
      connected_by: { user_id: conn.user_id, name: conn.display_name },
      connected_at: conn.created_at,
      token_expires_at: conn.expires_at,
      granted_scopes: grantedScopes,
      scope_status: scopeStatus,
      ads_access_configured: hasAdsAccess(),
      org_access_configured: hasOrgAccess(),
      can_post: grantedScopes.includes('w_member_social'),
      can_manage_organization: grantedScopes.includes('w_organization_social'),
      can_advertise: grantedScopes.includes('rw_ads'),
      can_sync_leads: grantedScopes.includes('r_ads_leadgen_automation'),
      can_send_conversions: grantedScopes.includes('rw_conversions'),
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

    res.json({ authorization_url: authUrlFor(state) });
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
