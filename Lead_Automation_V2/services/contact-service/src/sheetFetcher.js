/**
 * src/sheetFetcher.js
 *
 * Google Sheets URL parsing + fetching — extracted out of sheetsRoutes.js
 * so both sheetsRoutes.js (Support Agent "Import" tab, one-shot preview ->
 * write) and spreadsheetsRoutes.js (saved, editable spreadsheets) can read
 * a Google Sheet the same way instead of duplicating this logic.
 *
 * Two ways to read the sheet, tried in order:
 *   1. Sheets API v4 with a service account (private sheets — the sheet
 *      must be shared with the service account's client_email). Used
 *      whenever GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY is configured.
 *   2. Public CSV export (docs.google.com/.../export?format=csv) — works
 *      for any sheet shared as "Anyone with the link can view", no
 *      credentials needed. Always available as a fallback.
 * This MUST happen server-side, not from the browser: the CSV export
 * endpoint doesn't send CORS headers, and a service-account private key
 * must never reach the frontend.
 */
const XLSX = require('xlsx');
const { detectHeaderRow, cellToText } = require('./importer');
const { getSheetsClient, getServiceAccountEmail } = require('./googleAuth');

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Accepts any of the URL shapes a person is likely to paste:
 *   https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>
 *   https://docs.google.com/spreadsheets/d/<ID>/edit?usp=sharing
 *   https://docs.google.com/spreadsheets/d/<ID>
 *   or just the bare <ID> itself.
 * Returns { sheetId, gid } or null if it doesn't look like a Sheets
 * URL/ID at all.
 */
function parseSheetRef(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw)) {
    return { sheetId: raw, gid: null };
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!/(^|\.)google\.com$/i.test(url.hostname)) return null;

  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;

  const gidFromQuery = url.searchParams.get('gid');
  const gidFromHash = (url.hash.match(/gid=(\d+)/) || [])[1];
  const gid = gidFromQuery || gidFromHash || null;

  return { sheetId: match[1], gid };
}

async function fetchCsv(sheetId, gid) {
  const params = new URLSearchParams({ format: 'csv' });
  if (gid) params.set('gid', gid);
  const exportUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(exportUrl, { redirect: 'follow', signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Object.assign(new Error('Timed out fetching the sheet.'), { status: 504 });
    }
    throw Object.assign(new Error('Could not reach Google Sheets.'), { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 404) {
    throw Object.assign(new Error('Sheet not found — check the link.'), { status: 404 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Google Sheets returned an unexpected error (HTTP ${res.status}).`), { status: 502 });
  }

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  // A private/inaccessible sheet redirects to Google's HTML login/consent
  // page instead of returning CSV — Google still answers 200 OK for that
  // page, so status code alone can't distinguish it.
  const looksLikeHtml = /^\s*<(!doctype|html)/i.test(text) || contentType.includes('text/html');
  if (looksLikeHtml) {
    const svcEmail = getServiceAccountEmail();
    const hint = svcEmail ? ` Or share it with ${svcEmail} for private access.` : '';
    throw Object.assign(
      new Error(`This sheet isn't publicly viewable. Set sharing to "Anyone with the link can view" and try again.${hint}`),
      { status: 403 }
    );
  }

  return text;
}

/** Reads via the authenticated Sheets API v4 (service account). Returns
 *  null (not throws) if no credentials are configured, so the caller falls
 *  through to the public-CSV path. Throws only once we've actually tried
 *  and Google rejected the request (not shared, sheet deleted, etc). */
async function fetchViaServiceAccount(sheetId, gid) {
  const sheets = getSheetsClient();
  if (!sheets) return null;

  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  } catch (err) {
    const code = err.code || err.response?.status;
    if (code === 404) {
      throw Object.assign(new Error('Sheet not found — check the link.'), { status: 404 });
    }
    if (code === 403) {
      const svcEmail = getServiceAccountEmail();
      throw Object.assign(
        new Error(svcEmail
          ? `This service account can't access that sheet. Share it with ${svcEmail} (Viewer is enough), or make it public via link sharing.`
          : "This service account can't access that sheet. Share it with the service account's email, or make it public via link sharing."),
        { status: 403 }
      );
    }
    throw Object.assign(new Error('Could not reach Google Sheets.'), { status: 502 });
  }

  const tabs = meta.data.sheets || [];
  const byGid = gid ? tabs.find((t) => String(t.properties.sheetId) === String(gid)) : null;
  const tab = byGid || tabs[0];
  if (!tab) {
    throw Object.assign(new Error('That spreadsheet has no sheets/tabs.'), { status: 422 });
  }
  const tabTitle = tab.properties.title;

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabTitle.replace(/'/g, "''")}'`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const grid = valuesRes.data.values || [];
  return { grid, tabTitle };
}

/** Fetches and parses a sheet into a headers/rows grid, trying the
 *  authenticated path first, then the public CSV export. */
async function fetchSheetGrid(sheetId, gid) {
  const viaAuth = await fetchViaServiceAccount(sheetId, gid);
  let grid;
  let tabTitle = null;

  if (viaAuth) {
    grid = viaAuth.grid;
    tabTitle = viaAuth.tabTitle;
  } else {
    const text = await fetchCsv(sheetId, gid);
    if (!text.trim()) {
      throw Object.assign(new Error('That sheet (or tab) appears to be empty.'), { status: 422 });
    }
    try {
      const wb = XLSX.read(text, { type: 'string', raw: true });
      const firstSheetName = wb.SheetNames[0];
      tabTitle = firstSheetName;
      grid = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName], {
        header: 1, raw: true, defval: null, blankrows: false,
      });
    } catch {
      throw Object.assign(new Error('Could not parse that sheet as CSV data.'), { status: 422 });
    }
  }

  if (!grid || !grid.length) {
    throw Object.assign(new Error('That sheet (or tab) appears to be empty.'), { status: 422 });
  }

  const { headerRow, headers } = detectHeaderRow(grid);
  if (headerRow < 0 || !headers.length) {
    throw Object.assign(new Error("Couldn't detect a header row in that sheet."), { status: 422 });
  }

  const dataRows = grid
    .slice(headerRow + 1)
    .filter((r) => r.some((c) => cellToText(c) !== ''));

  return { headers, dataRows, tabTitle };
}

module.exports = { parseSheetRef, fetchSheetGrid };