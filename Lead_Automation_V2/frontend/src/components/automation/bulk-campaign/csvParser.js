/**
 * csvParser.js
 *
 * Minimal RFC-4180-ish CSV parser for the Bulk Campaign uploader
 * (BulkCampaignTab.jsx). Deliberately hand-rolled rather than pulling in
 * papaparse: the uploader only ever needs "split rows/columns, respect
 * quoted fields containing commas" — a small, dependency-free parser is
 * both good enough for that and keeps `frontend/package.json` free of a
 * library the rest of this codebase doesn't otherwise use.
 *
 * Also handles the trivial "recipient list" case: a plain multi-line/
 * comma-separated list of phone numbers with no header row at all (the
 * BulkCampaignTab's "manual entry" textarea reuses this).
 */

/** Splits one CSV line into fields, respecting double-quoted values. */
function splitCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++; // skip the escaped quote's second character
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses raw CSV text into { headers, rows }.
 * `rows` is an array of plain objects keyed by header name — every value
 * is a string; callers (e.g. the column-mapping UI) decide what to do
 * with each column.
 */
export function parseCsv(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const fields = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = fields[i] ?? ''; });
    return row;
  });

  return { headers, rows };
}

/**
 * Parses the "manual entry" textarea: numbers separated by commas and/or
 * newlines, blank entries ignored. Returns recipient-shaped objects so the
 * caller can treat manual entry and CSV rows identically downstream.
 */
export function parseManualRecipients(text) {
  return (text || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((phone) => ({ phone, name: '', variables: {} }));
}

/**
 * Very forgiving phone-number sanity check for client-side feedback only
 * (real validation/formatting belongs server-side or with the eventual
 * carrier integration) — flags obviously-unusable rows before they're even
 * sent, e.g. an empty cell or a stray text value where a phone number was
 * expected.
 */
export function looksLikePhoneNumber(value) {
  return typeof value === 'string' && /\+?[\d()\-.\s]{7,}/.test(value.trim());
}
