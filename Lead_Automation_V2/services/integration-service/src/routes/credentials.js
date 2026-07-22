/**
 * src/routes/credentials.js
 *
 * "API Credentials" settings page backend — lets an admin paste in Meta
 * App ID / App Secret / Page Access Token by hand instead of going through
 * the Facebook Login OAuth dialog in routes/auth.js. Useful when an org
 * already has these values from Meta Business Manager, or is running its
 * own Meta App and wants to store its own App ID/Secret rather than share
 * the deployment-wide one in .env.
 *
 * This writes to the exact same 'instagram' provider row (same field
 * names) that the OAuth callback in routes/auth.js writes to, so
 * everything downstream — routes/facebook.js, routes/instagram.js,
 * webhook routing via services/credentials.js:getCredentialsByMetaId —
 * works identically no matter which path was used to connect. WhatsApp
 * already has its own equivalent manual-entry endpoint at
 * POST /whatsapp/connect (routes/whatsapp.js); this is the Facebook/
 * Instagram counterpart.
 *
 * SECURITY:
 *  - Mounted in index.js AFTER app.use(authenticate), so every route here
 *    requires a valid JWT and is scoped to req.user.organizationId (also
 *    backstopped by Postgres RLS — see infra/db/rls.sql).
 *  - Writing credentials is admin-only (requireRole('admin')) since these
 *    are the most sensitive secrets in the system.
 *  - app_secret, page_access_token, and long_lived_user_token are
 *    encrypted at rest with AES-256-GCM before being stored (see
 *    services/crypto.js) — the "firewall" around this data is: encryption
 *    at rest, per-organization row-level security, admin-only writes, and
 *    the fact these values are never re-serialized back to the browser
 *    once saved (GET below returns metadata only, never secrets).
 *  - The pasted-in Page Access Token is validated against Meta's own
 *    /debug_token endpoint before anything is saved, and the row is
 *    locked immediately afterwards (services/credentials.js), the same
 *    pattern used by the OAuth flow and by WhatsApp's manual connect.
 */

const express = require('express');
const router = express.Router();
const { pool, requireRole } = require('@lead/shared');
const { validateToken, getAppSecretProof, GRAPH_URL } = require('../services/graphApi');
const { getConnectionLockState, lockConnection } = require('../services/credentials');
const { encryptCredentialTokens } = require('../services/crypto');

// Facebook Page + linked Instagram Business Account share one connection
// row, same as the OAuth callback in routes/auth.js.
const PROVIDER = 'instagram';

/**
 * GET /credentials/facebook
 * Metadata only — never returns app_secret or page_access_token. Lets the
 * settings page render "already saved" state (App ID, Page name/ID,
 * detected Instagram account, expiry, lock status) without ever pulling
 * secrets back down to the browser.
 */
router.get('/facebook', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT status, locked_at, credentials FROM integrations
       WHERE organization_id = $1 AND provider = $2
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.organizationId, PROVIDER]
    );

    if (rows.length === 0) {
      return res.json({ connected: false, locked: false });
    }

    const c = rows[0].credentials || {};
    res.json({
      connected: rows[0].status === 'connected',
      locked: rows[0].locked_at != null,
      appId: c.app_id || null,
      hasAppSecret: Boolean(c.app_secret),
      pageId: c.page_id || null,
      pageName: c.page_name || null,
      instagramBusinessAccountId: c.instagram_business_account_id || null,
      tokenExpiresAt: c.token_expires_at || null,
    });
  } catch (err) {
    console.error('GET /credentials/facebook error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /credentials/facebook  (admin only)
 * Body: {
 *   "appId": "2003979257150109",
 *   "appSecret": "...",              // optional but recommended — stored encrypted
 *   "pageId": "1234567890",
 *   "pageName": "My Business Page",  // optional, cosmetic
 *   "pageAccessToken": "EAAG..."     // long-lived Page token from Meta
 * }
 *
 * Validates the token against Meta's /debug_token endpoint, auto-detects
 * the Instagram Business Account linked to the Page (same lookup the OAuth
 * callback does), encrypts the secret fields, upserts the org's single
 * 'instagram' row, and locks it — matching routes/whatsapp.js POST /connect.
 */
router.post('/facebook', requireRole('admin'), async (req, res) => {
  const { appId, appSecret, pageId, pageName, pageAccessToken } = req.body;

  if (!pageId || !pageAccessToken) {
    return res.status(400).json({ error: 'pageId and pageAccessToken are required.' });
  }

  try {
    const lockState = await getConnectionLockState(req.user.organizationId, PROVIDER);
    if (lockState.locked) {
      return res.status(403).json({
        error: 'This Instagram/Facebook connection is locked and can no longer be edited. Contact your account admin if it needs to change.',
      });
    }

    const validation = await validateToken(pageAccessToken);
    if (!validation.valid) {
      console.warn('Facebook Page token failed validation on manual connect:', validation.raw);
      return res.status(400).json({
        error: 'That Page Access Token is not valid. Double-check it was copied in full and has not expired or been revoked.',
      });
    }

    // Best-effort auto-detect of the linked Instagram Business Account, so
    // a manually-entered Page token gets full Instagram support too, not
    // just Facebook. Failure here isn't fatal — the connection is still
    // useful for Facebook alone.
    let instagramBusinessAccountId = null;
    try {
      const proof = getAppSecretProof(pageAccessToken);
      const igRes = await fetch(
        `${GRAPH_URL}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}&appsecret_proof=${proof}`
      );
      const igData = await igRes.json();
      instagramBusinessAccountId = igData.instagram_business_account?.id || null;
    } catch (e) {
      console.warn('Could not auto-detect linked Instagram Business Account:', e.message);
    }

    const credentials = {
      app_id: appId || null,
      app_secret: appSecret || null,
      page_id: pageId,
      page_name: pageName || null,
      page_access_token: pageAccessToken,
      instagram_business_account_id: instagramBusinessAccountId,
      token_expires_at: validation.expiresAt,
    };
    const storedCredentials = encryptCredentialTokens(credentials);

    const { rows: existing } = await pool.query(
      `SELECT id FROM integrations WHERE organization_id = $1 AND provider = $2 ORDER BY created_at DESC LIMIT 1`,
      [req.user.organizationId, PROVIDER]
    );

    let row;
    if (existing.length > 0) {
      const { rows } = await pool.query(
        `UPDATE integrations SET status = 'connected', credentials = $1
         WHERE id = $2 RETURNING id, provider, status, created_at`,
        [JSON.stringify(storedCredentials), existing[0].id]
      );
      row = rows[0];
    } else {
      const { rows } = await pool.query(
        `INSERT INTO integrations (organization_id, provider, status, credentials)
         VALUES ($1, $2, 'connected', $3)
         RETURNING id, provider, status, created_at`,
        [req.user.organizationId, PROVIDER, JSON.stringify(storedCredentials)]
      );
      row = rows[0];
    }

    // Token just passed Meta's /debug_token check above — same
    // "verification" bar as the OAuth flow — so lock it immediately.
    await lockConnection(req.user.organizationId, PROVIDER, req.user.userId || null);

    console.log('SAVED MANUAL FACEBOOK/INSTAGRAM CREDENTIALS:', row, 'for organization:', req.user.organizationId, '(locked)');
    res.status(201).json({ ...row, locked: true, instagramBusinessAccountId });
  } catch (err) {
    console.error('POST /credentials/facebook error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
