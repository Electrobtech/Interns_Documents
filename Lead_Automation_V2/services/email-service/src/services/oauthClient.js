/**
 * src/services/oauthClient.js
 *
 * Google OAuth 2.0 token exchange/refresh for Gmail. Deliberately its own
 * copy rather than reusing review-service's oauthClient.js — that one
 * requests `business.manage` scope for Google Business Profile; this one
 * requests Gmail scopes, and a user may need to grant them independently
 * (e.g. connect Google Reviews without ever connecting Gmail, or vice
 * versa). Same request shape though, both being plain Google OAuth.
 *
 * A single global GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET pair is used
 * (see .env.example) rather than review-service's per-tenant
 * google_oauth_configs table — Step 1-4 of the setup this module expects
 * ("Create Google Cloud Project" / "Configure OAuth Consent Screen" /
 * "Create OAuth Client") match a single Google Cloud project owned by the
 * platform operator. Per-tenant client credentials could be layered on
 * later the same way review-service's configStore.js does it, if a
 * customer ever needs to bring their own Google Cloud project.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// gmail.modify covers read + send + label management + trash, which is
// everything this module's "Receiving/Sending/Threading/Attachments/
// Labels" feature set needs, without requesting gmail.settings.basic or
// full account access.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

function assertConfigured() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REDIRECT_URI) {
    const err = new Error('Gmail OAuth is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI.');
    err.status = 500;
    throw err;
  }
}

/**
 * Builds the URL the browser is sent to for Google's consent screen.
 * `state` is a signed JWT (see @lead/shared sign/verify) carrying
 * organizationId + userId, since Google's redirect to /email/auth/callback
 * can't carry our own Authorization header.
 *
 * access_type=offline + prompt=consent guarantees a refresh_token comes
 * back even on a re-connect (Google only issues one on the very first
 * consent otherwise).
 */
function buildAuthUrl(state) {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID,
    redirect_uri: process.env.GMAIL_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
  assertConfigured();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      redirect_uri: process.env.GMAIL_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Failed to exchange Google authorization code');
    err.status = 502;
    throw err;
  }
  // { access_token, expires_in, refresh_token, scope, token_type, id_token }
  return data;
}

async function refreshAccessToken(refreshToken) {
  assertConfigured();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Failed to refresh Gmail access token');
    err.status = data.error === 'invalid_grant' ? 401 : 502;
    throw err;
  }
  // { access_token, expires_in, scope, token_type }
  return data;
}

async function revokeToken(token) {
  if (!token) return;
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' });
  } catch (err) {
    console.warn('[email-service/oauth] token revoke call failed (continuing anyway):', err.message);
  }
}

module.exports = { buildAuthUrl, exchangeCode, refreshAccessToken, revokeToken, SCOPES };
