/**
 * src/sheetsRoutes.js
 *
 * Task 5/5 (Support Agent — Google Sheets import): "paste a link, extract
 * and display the data". Scoped to publicly-viewable sheets only ("Anyone
 * with the link can view") — no Google OAuth consent flow, no service
 * account. That's a materially bigger integration and out of scope here.
 *
 * A public Google Sheet can be pulled as CSV via a stable, undocumented
 * but long-standing export endpoint:
 *   https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<GID>
 *
 * This MUST happen server-side, not from the browser:
 *   - Google's export endpoint does not reliably send CORS headers, so a
 *     browser `fetch()` to it from our frontend origin would just fail.
 *   - Routing it through this authenticated, rate-limited backend avoids
 *     handing every logged-in browser tab a generic "fetch any URL" proxy.
 *
 * Lives on contact-service (rather than integration-service) because the
 * realistic next step for this data is "import these rows as leads/
 * contacts" — this route reuses importer.js's header-detection logic for
 * exactly that reason, even though this task itself only previews.
 */
const express = require('express');
const XLSX = require('xlsx');
const { detectHeaderRow, cellToText } = require('./importer');

const router = express.Router();

const MAX_ROWS = 500;
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

  // Bare sheet ID (Sheets IDs are a long alphanumeric/-_ token — no slashes,
  // no dots — so this is a safe, narrow match that won't also swallow a
  // malformed URL fragment).
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

  // gid can show up in the query string (?gid=123) or the hash (#gid=123)
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
  // page, so status code alone can't distinguish it. Detect it explicitly
  // rather than silently rendering the login page's markup as "data".
  const looksLikeHtml = /^\s*<(!doctype|html)/i.test(text) || contentType.includes('text/html');
  if (looksLikeHtml) {
    throw Object.assign(
      new Error("This sheet isn't publicly viewable. Set sharing to \"Anyone with the link can view\" and try again."),
      { status: 403 }
    );
  }

  return text;
}

// POST /sheets/preview — body: { url }
// Returns { headers: string[], rows: string[][], truncated: boolean, rowCount: number }
router.post('/sheets/preview', async (req, res) => {
  const { url } = req.body || {};
  const ref = parseSheetRef(url);
  if (!ref) {
    return res.status(400).json({
      error: "That doesn't look like a Google Sheets link. Paste a docs.google.com/spreadsheets URL (or just the sheet ID).",
    });
  }

  let csvText;
  try {
    csvText = await fetchCsv(ref.sheetId, ref.gid);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }

  if (!csvText.trim()) {
    return res.status(422).json({ error: 'That sheet (or tab) appears to be empty.' });
  }

  let grid;
  try {
    const wb = XLSX.read(csvText, { type: 'string', raw: true });
    const firstSheetName = wb.SheetNames[0];
    grid = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName], {
      header: 1, raw: true, defval: null, blankrows: false,
    });
  } catch {
    return res.status(422).json({ error: 'Could not parse that sheet as CSV data.' });
  }

  if (!grid.length) {
    return res.status(422).json({ error: 'That sheet (or tab) appears to be empty.' });
  }

  const { headerRow, headers } = detectHeaderRow(grid);
  if (headerRow < 0 || !headers.length) {
    return res.status(422).json({ error: "Couldn't detect a header row in that sheet." });
  }

  const dataRows = grid
    .slice(headerRow + 1)
    .filter((r) => r.some((c) => cellToText(c) !== ''));

  const truncated = dataRows.length > MAX_ROWS;
  const rows = dataRows.slice(0, MAX_ROWS).map((r) => headers.map((_, i) => cellToText(r[i])));

  res.json({
    headers,
    rows,
    rowCount: dataRows.length,
    truncated,
  });
});

module.exports = router;
