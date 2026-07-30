/**
 * src/services/oauthClient.js
 *
 * Google OAuth 2.0 token exchange/refresh for Google Calendar. Same shape
 * as email-service/src/services/oauthClient.js — a single global
 * GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET pair (one
 * Google Cloud project owned by the platform operator), rather than
 * review-service's per-tenant config table. Kept as its own copy (not a
 * shared dependency) because it requests Calendar-specific scopes and a
 * user may connect Calendar independently of Gmail/Reviews.
 *
 * IMPORTANT: the OAuth client used here must be a "Web application" type
 * client in Google Cloud Console (Credentials > Create Credentials >
 * OAuth client ID > Web application), with GOOGLE_CALENDAR_REDIRECT_URI
 * added under "Authorized redirect URIs". A "Desktop app" / "installed"
 * client (redirect_uri http://localhost) will NOT work for this
 * server-side callback flow — assertConfigured() below only checks that
 * values are present, not which client type they came from, so a 400 from
 * Google at the token exchange step ("redirect_uri_mismatch") is the
 * usual symptom of using the wrong client type.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// calendar.events covers create/update/delete/list on events (everything
// "book a meeting" / "check availability" / "schedule a follow-up" needs);
// calendar.readonly (list of calendars) lets a user pick which calendar to
// book into instead of always assuming "primary".
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

function assertConfigured() {
  const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI } = process.env;
  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET || !GOOGLE_CALENDAR_REDIRECT_URI) {
    const err = new Error('Google Calendar OAuth is not configured. Set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI.');
    err.status = 500;
    throw err;
  }
}

/**
 * Builds the URL the browser is sent to for Google's consent screen.
 * `state` is a signed JWT (see @lead/shared sign/verify) carrying
 * organizationId + userId, since Google's redirect to
 * /calendar/auth/callback can't carry our own Authorization header.
 *
 * access_type=offline + prompt=consent guarantees a refresh_token comes
 * back even on a re-connect (Google only issues one on the very first
 * consent otherwise).
 */
function buildAuthUrl(state) {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
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
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
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
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Failed to refresh Google Calendar access token');
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
    console.warn('[calendar-service/oauth] token revoke call failed (continuing anyway):', err.message);
  }
}

module.exports = { buildAuthUrl, exchangeCode, refreshAccessToken, revokeToken, SCOPES };
