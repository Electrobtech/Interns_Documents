const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function assertConfigured() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    const err = new Error('Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI)');
    err.status = 500;
    throw err;
  }
}

// Builds the URL the browser is sent to for the Google consent screen.
// `state` is a signed JWT (see shared verify/sign) carrying organizationId +
// userId, since Google's redirect back to /google/callback can't carry our
// own Authorization header.
function buildAuthUrl(state) {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
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

async function exchangeCode(code) {
  assertConfigured();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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

async function refreshAccessToken(refreshToken) {
  assertConfigured();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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
