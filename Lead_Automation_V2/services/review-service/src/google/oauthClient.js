const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// `creds` is { clientId, clientSecret } — resolved per-tenant by the caller
// (see ./configStore.js#resolveCredentials), since each organization can
// configure its own Google OAuth client instead of sharing one global pair.
function assertConfigured(creds) {
  if (!creds || !creds.clientId || !creds.clientSecret || !REDIRECT_URI) {
    const err = new Error('Google OAuth is not configured. Save a Client ID and Client Secret first.');
    err.status = 400;
    throw err;
  }
}

// Builds the URL the browser is sent to for the Google consent screen.
// `state` is a signed JWT (see shared verify/sign) carrying organizationId +
// userId, since Google's redirect back to /google/callback can't carry our
// own Authorization header.
function buildAuthUrl(state, creds) {
  assertConfigured(creds);
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code, creds) {
  assertConfigured(creds);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Failed to exchange Google authorization code');
    err.status = 502;
    throw err;
  }
  // { access_token, expires_in, refresh_token, scope, token_type, id_token? }
  return data;
}

async function refreshAccessToken(refreshToken, creds) {
  assertConfigured(creds);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Failed to refresh Google access token');
    err.status = data.error === 'invalid_grant' ? 401 : 502;
    throw err;
  }
  // { access_token, expires_in, scope, token_type }
  return data;
}

module.exports = { buildAuthUrl, exchangeCode, refreshAccessToken, SCOPE };
