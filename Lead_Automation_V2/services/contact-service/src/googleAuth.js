/**
 * src/googleAuth.js
 *
 * Service-account auth for the Sheets API v4 (private sheets — "Anyone with
 * the link" sharing is NOT required as long as the sheet is shared with the
 * service account's client_email, same as any other Google API service
 * account).
 *
 * Credentials come ONLY from the environment — never hardcode a private key
 * in source. Set GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY to the full JSON key file
 * contents (as one line, e.g. via `jq -c . key.json` when putting it in
 * .env, or as a multi-line secret in whatever secret manager deploys this
 * service). If that variable is unset, private-sheet access is simply
 * unavailable and callers fall back to the public-CSV path (see
 * sheetsRoutes.js) — this module never throws just because it's unconfigured.
 */
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

let cachedClient = null;
let attempted = false;

/** Returns an authenticated googleapis Sheets client, or null if no service
 *  account is configured / the key is malformed. Never throws. */
function getSheetsClient() {
  if (cachedClient) return cachedClient;
  if (attempted) return null; // already tried and failed this process lifetime
  attempted = true;

  const raw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    console.error('[googleAuth] GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY is set but is not valid JSON — private Sheets import disabled.');
    return null;
  }

  if (!key.client_email || !key.private_key) {
    console.error('[googleAuth] GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY is missing client_email/private_key — private Sheets import disabled.');
    return null;
  }

  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
  });

  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

/** The service account's own email, so the UI can tell a user which
 *  address to share their private sheet with. Null if unconfigured. */
function getServiceAccountEmail() {
  const raw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    return JSON.parse(raw).client_email || null;
  } catch {
    return null;
  }
}

module.exports = { getSheetsClient, getServiceAccountEmail };
