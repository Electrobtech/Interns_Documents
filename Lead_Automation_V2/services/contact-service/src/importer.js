/**
 * src/importer.js
 *
 * Spreadsheet -> contacts import: parsing, column detection, normalisation,
 * validation, and de-duplication. Pure functions only (no db, no express) so
 * the rules are testable and the route stays thin.
 *
 * Written against the shapes real exported sheets actually produce, not ideal
 * CSV:
 *   - Dates arrive as Excel serial numbers (46204) rather than ISO strings.
 *   - Phone columns come through as floats in scientific notation
 *     (7.349572907E9) because the exporter treated them as numbers.
 *   - Emails carry stray leading quotes from formula-escaped cells
 *     ("partnerships@example.org).
 *   - Header rows are frequently padded with trailing empty columns, and
 *     sheets often carry a pivot/summary tab alongside the real data.
 */

const XLSX = require('xlsx');

/** contacts columns an import is allowed to populate. */
const TARGET_FIELDS = ['name', 'email', 'phone', 'source', 'notes', 'tags'];

/**
 * Header aliases per target field, matched case/space/punctuation-insensitively.
 * Ordered most- to least- specific: 'mobile number' should win over 'number'.
 */
const HEADER_ALIASES = {
  name: ['full name', 'contact person', 'contact name', 'name', 'ngo', 'college name', 'institution name', 'person'],
  email: ['email address', 'mail id', 'email id', 'e mail', 'email', 'mail'],
  phone: ['mobile number', 'contact number', 'phone number', 'mobile', 'contact no', 'phone', 'whatsapp'],
  source: ['source', 'lead source', 'channel', 'reference', 'refernce'],
  notes: ['remarks', 'notes', 'status', 'comment', 'comments', 'description'],
};

const canon = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Excel's epoch is 1899-12-30 (its 1900 leap-year bug is baked in). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const EXCEL_SERIAL_MIN = 20000;  // ~1954 — below this it's far more likely a real number
const EXCEL_SERIAL_MAX = 60000;  // ~2064

function excelSerialToISO(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < EXCEL_SERIAL_MIN || n > EXCEL_SERIAL_MAX) return null;
  const ms = EXCEL_EPOCH_MS + Math.round(n * 86400000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Renders any cell as the text a human saw in the sheet. Large numbers are
 * the dangerous case: String(7349572907) is fine but String(7.349572907e9)
 * from a float cell must not become "7.349572907e+9".
 */
function cellToText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    // integral values print in full, never in exponential form
    if (Number.isInteger(v)) return v.toFixed(0);
    return String(v);
  }
  return String(v).trim();
}

/**
 * Phones survive the round trip through a float cell, so recover digits
 * rather than trusting the text. Keeps a leading + for international form.
 */
function normalisePhone(raw) {
  let text = cellToText(raw);
  if (!text) return null;

  // 7.349572907E9 / 7.349572907e+9 -> 7349572907
  if (/^[+-]?\d(\.\d+)?[eE][+-]?\d+$/.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) text = n.toFixed(0);
  }

  const hadPlus = text.trim().startsWith('+');
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;

  // 10-digit Indian mobiles and 11-13 digit international forms are both
  // real; anything shorter than 7 is a truncated/placeholder value.
  if (digits.length < 7 || digits.length > 15) return { value: digits, suspect: true };
  return { value: hadPlus ? `+${digits}` : digits, suspect: false };
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;

function normaliseEmail(raw) {
  let text = cellToText(raw);
  if (!text) return null;
  // strip the formula-escape quote and any surrounding quotes/whitespace
  text = text.replace(/^["'\s]+/, '').replace(/["'\s]+$/, '');
  // a cell holding several addresses: take the first, keep the rest as a note
  const parts = text.split(/[,;/\s]+/).filter(Boolean);
  const first = (parts[0] || '').toLowerCase();
  if (!first) return null;
  return { value: first, valid: EMAIL_RE.test(first), extra: parts.slice(1) };
}

function normaliseName(raw) {
  const text = cellToText(raw).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  // Some rows repeat the email in the name column; that is not a name.
  if (EMAIL_RE.test(text)) return null;
  return text;
}

/**
 * Reads the workbook and returns one descriptor per sheet: headers, row
 * count, and a suggested field mapping. Lets the UI show the user what was
 * found (including which tab is the pivot/summary) before anything is written.
 */
function inspectWorkbook(buffer, filename) {
  const isCsv = /\.csv$/i.test(filename || '');
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    // Keep raw values: we do our own date/number handling above, and cellDates
    // would silently reinterpret numeric columns we care about as dates.
    cellDates: false,
    raw: true,
    codepage: 65001,
  });

  const sheets = wb.SheetNames.map((sheetName) => {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1, raw: true, defval: null, blankrows: false,
    });
    const { headerRow, headers } = detectHeaderRow(grid);
    const dataRows = headerRow < 0 ? [] : grid.slice(headerRow + 1)
      .filter((r) => r.some((c) => cellToText(c) !== ''));

    return {
      sheetName,
      headerRowIndex: headerRow,
      headers,
      rowCount: dataRows.length,
      suggestedMapping: suggestMapping(headers),
      sampleRows: dataRows.slice(0, 3).map((r) => headers.map((_, i) => cellToText(r[i]))),
    };
  });

  return { isCsv, sheets };
}

/**
 * Real sheets often start with a title or blank line, so the header is not
 * guaranteed to be row 0. Score the first few rows and take the one that
 * looks most like a header (mostly non-empty text, no pure numbers).
 */
function detectHeaderRow(grid) {
  let best = { score: -1, index: -1, headers: [] };
  const limit = Math.min(grid.length, 8);

  for (let i = 0; i < limit; i++) {
    const row = grid[i] || [];
    const cells = row.map(cellToText);
    const filled = cells.filter((c) => c !== '');
    if (filled.length < 2) continue;

    const numericish = filled.filter((c) => /^-?\d+(\.\d+)?$/.test(c)).length;
    const recognised = filled.filter((c) => matchField(c)).length;
    // prefer rows that are wide, textual, and contain known field names
    const score = filled.length + recognised * 3 - numericish * 2;

    if (score > best.score) {
      best = { score, index: i, headers: trimTrailingEmpty(cells) };
    }
  }
  return { headerRow: best.index, headers: best.headers };
}

function trimTrailingEmpty(arr) {
  const out = arr.slice();
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

function matchField(header) {
  const h = canon(header);
  if (!h) return null;
  for (const field of Object.keys(HEADER_ALIASES)) {
    for (const alias of HEADER_ALIASES[field]) {
      const a = canon(alias);
      if (h === a) return field;
    }
  }
  // fall back to substring, longest alias first so 'mobile number' beats 'number'
  const ranked = [];
  for (const field of Object.keys(HEADER_ALIASES)) {
    for (const alias of HEADER_ALIASES[field]) ranked.push([field, canon(alias)]);
  }
  ranked.sort((a, b) => b[1].length - a[1].length);
  for (const [field, a] of ranked) {
    if (a && h.includes(a)) return field;
  }
  return null;
}

/**
 * header index -> target field. A field is only claimed once (first match
 * wins) so a sheet with both 'Status' and 'Remarks' does not map both to
 * notes and silently drop one.
 */
function suggestMapping(headers) {
  const mapping = {};
  const claimed = new Set();
  headers.forEach((h, i) => {
    const field = matchField(h);
    if (field && !claimed.has(field)) {
      mapping[i] = field;
      claimed.add(field);
    }
  });
  return mapping;
}

/**
 * Turns raw sheet rows into candidate contact records.
 *
 * mapping: { [columnIndex]: targetField }
 * options: { defaultSource, unmappedToNotes, sheetName }
 *
 * Returns { records, issues, stats } where records are insert-ready and
 * issues explains every row that was rejected or altered, by row number.
 */
function buildRecords({ headers, rows, mapping, options = {} }) {
  const { defaultSource, unmappedToNotes = true, sheetName } = options;
  const records = [];
  const issues = [];
  const stats = { total: rows.length, valid: 0, skipped: 0, warned: 0 };

  const mappedIdx = new Set(Object.keys(mapping).map(Number));

  rows.forEach((row, i) => {
    const rowNumber = i + 1;
    const rec = { tags: [], notesParts: [] };
    const rowIssues = [];

    for (const [idxStr, field] of Object.entries(mapping)) {
      const idx = Number(idxStr);
      const raw = row[idx];

      if (field === 'name') {
        const v = normaliseName(raw);
        if (v) rec.name = v;
      } else if (field === 'email') {
        const e = normaliseEmail(raw);
        if (e) {
          if (e.valid) {
            rec.email = e.value;
            if (e.extra.length) rec.notesParts.push(`Other emails: ${e.extra.join(', ')}`);
          } else {
            rowIssues.push({ level: 'warning', field: 'email', message: `Dropped unparseable email "${cellToText(raw)}"` });
          }
        }
      } else if (field === 'phone') {
        const p = normalisePhone(raw);
        if (p) {
          if (p.suspect) {
            rowIssues.push({ level: 'warning', field: 'phone', message: `Phone "${cellToText(raw)}" has ${p.value.length} digits — imported as-is` });
          }
          rec.phone = p.value;
        }
      } else if (field === 'source') {
        const v = cellToText(raw);
        if (v) rec.source = v;
      } else if (field === 'notes') {
        const v = cellToText(raw);
        if (v) rec.notesParts.push(`${headers[idx] || 'Notes'}: ${v}`);
      }
    }

    // Everything the user did not map is preserved as a note rather than
    // discarded — these sheets carry real context (category, place, branch)
    // that has no dedicated contacts column.
    if (unmappedToNotes) {
      headers.forEach((h, idx) => {
        if (mappedIdx.has(idx)) return;
        const text = cellToText(row[idx]);
        if (!text) return;
        const label = h || `Column ${idx + 1}`;
        // Excel serial dates only make sense once decoded
        const asDate = /date|day/i.test(label) ? excelSerialToISO(text) : null;
        rec.notesParts.push(`${label}: ${asDate || text}`);
      });
    }

    if (!rec.source && defaultSource) rec.source = defaultSource;
    if (sheetName) rec.tags.push(sheetName.trim());

    // A contact with no name and no way to reach it is not a contact.
    if (!rec.name && !rec.email && !rec.phone) {
      stats.skipped++;
      issues.push({ rowNumber, level: 'error', message: 'No name, email, or phone — row skipped' });
      return;
    }
    if (!rec.email && !rec.phone) {
      rowIssues.push({ level: 'warning', field: 'contactability', message: 'No email or phone — contact cannot be messaged' });
    }

    records.push({
      rowNumber,
      name: rec.name || null,
      email: rec.email || null,
      phone: rec.phone || null,
      source: rec.source || null,
      notes: rec.notesParts.length ? rec.notesParts.join(' | ') : null,
      tags: rec.tags,
    });
    stats.valid++;
    if (rowIssues.length) {
      stats.warned++;
      rowIssues.forEach((ri) => issues.push({ rowNumber, ...ri }));
    }
  });

  return { records, issues, stats };
}

/**
 * Marks records that duplicate an earlier row in the same file. Identity is
 * phone-then-email (either is enough); name alone is too weak to dedupe on.
 */
function markInFileDuplicates(records) {
  const seen = new Map();
  const duplicates = [];
  const unique = [];

  for (const rec of records) {
    const keys = [rec.phone && `p:${rec.phone}`, rec.email && `e:${rec.email}`].filter(Boolean);
    const hit = keys.find((k) => seen.has(k));
    if (hit) {
      duplicates.push({ rowNumber: rec.rowNumber, level: 'info', message: `Duplicate of row ${seen.get(hit)} in this file — skipped` });
      continue;
    }
    keys.forEach((k) => seen.set(k, rec.rowNumber));
    unique.push(rec);
  }
  return { unique, duplicates };
}

module.exports = {
  TARGET_FIELDS,
  HEADER_ALIASES,
  inspectWorkbook,
  buildRecords,
  markInFileDuplicates,
  // exported for the route and for tests
  normalisePhone,
  normaliseEmail,
  normaliseName,
  excelSerialToISO,
  cellToText,
  suggestMapping,
  matchField,
  // Exported for sheetsRoutes.js (Google Sheets CSV import preview) — reuses
  // this same "which row is actually the header" heuristic instead of
  // re-implementing it, so a public Google Sheet with a title/blank row
  // above the real header gets detected the same way an uploaded XLSX does.
  detectHeaderRow,
  trimTrailingEmpty,
};
