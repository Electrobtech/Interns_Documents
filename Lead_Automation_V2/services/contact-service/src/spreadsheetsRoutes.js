/**
 * src/spreadsheetsRoutes.js
 *
 * Saved, editable spreadsheets (Support Agent "Import" tab). Unlike
 * sheetsRoutes.js's one-shot "paste a link, map columns, import" flow,
 * a spreadsheet created here is persisted as a grid (headers + rows) that
 * the user can open, edit cell-by-cell, save, and import into
 * contacts/leads whenever they're ready — the CRM import reads whatever
 * is currently saved, so editing a cell and re-importing picks up the
 * edit.
 *
 *   POST   /spreadsheets/upload        -> new spreadsheet from an uploaded
 *                                          .csv/.xlsx/.xls file
 *   POST   /spreadsheets/from-link     -> new spreadsheet fetched from a
 *                                          Google Sheets URL
 *   GET    /spreadsheets               -> list this org's saved spreadsheets
 *   GET    /spreadsheets/:id           -> one spreadsheet's full grid
 *   PUT    /spreadsheets/:id           -> save edits (name and/or full
 *                                          headers+rows grid)
 *   DELETE /spreadsheets/:id
 *   POST   /spreadsheets/:id/import    -> write the CURRENT (possibly
 *                                          edited) grid into contacts/leads,
 *                                          same mapping/dedupe pipeline as
 *                                          the CSV/XLSX and Sheets-link
 *                                          importers
 *
 * Table: imported_sheets — see infra/db/migrations/037_imported_sheets.sql.
 * NOTE for an already-running database (docker-entrypoint-initdb.d only
 * runs once, on a fresh volume): apply that migration by hand, e.g.
 *   docker compose exec -T postgres psql -U app_user -d lead_automation \
 *     < infra/db/migrations/037_imported_sheets.sql
 * (then re-run infra/db/rls.sql the same way so the new table gets RLS).
 */
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool, requirePermission, logAudit } = require('@lead/shared');
const {
  cellToText, inspectWorkbook, buildRecords, markInFileDuplicates,
} = require('./importer');
const { writeContacts } = require('./contactWriter');
const { parseSheetRef, fetchSheetGrid } = require('./sheetFetcher');

const router = express.Router();
const canRead = requirePermission('contacts:read');
const canWrite = requirePermission('contacts:write');
const canDelete = requirePermission('contacts:delete');

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB, same cap as importRoutes.js
const MAX_ROWS = 20000; // same cap as the other two importers
const MAX_COLS = 200; // sane ceiling for the editable grid itself

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(csv|xlsx|xls)$/i.test(file.originalname)) return cb(null, true);
    cb(Object.assign(new Error('Only .csv, .xlsx, and .xls files are supported.'), { status: 400 }));
  },
});

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `File is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`
        : err.message;
      return res.status(status).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded — send it as multipart field "file".' });
    next();
  });
}

/** Row shape returned to the frontend for both list and detail views. */
function toSummary(row) {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    sourceRef: row.source_ref,
    columnCount: Array.isArray(row.headers) ? row.headers.length : 0,
    rowCount: Array.isArray(row.rows) ? row.rows.length : 0,
    lastImportedAt: row.last_imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDetail(row) {
  return { ...toSummary(row), headers: row.headers, rows: row.rows };
}

/** Every cell normalised to string|number|null so it round-trips through
 *  JSONB and back into an <input> cleanly — no Dates, no XLSX rich objects. */
function normaliseCell(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return cellToText(v);
}

function normaliseGrid(headers, rows) {
  if (!Array.isArray(headers) || !headers.length) {
    throw Object.assign(new Error('A spreadsheet needs at least one column.'), { status: 422 });
  }
  if (headers.length > MAX_COLS) {
    throw Object.assign(new Error(`That sheet has ${headers.length} columns; the limit is ${MAX_COLS}.`), { status: 413 });
  }
  if (!Array.isArray(rows)) {
    throw Object.assign(new Error('Rows must be an array.'), { status: 422 });
  }
  if (rows.length > MAX_ROWS) {
    throw Object.assign(new Error(`That sheet has ${rows.length} rows; the limit is ${MAX_ROWS}.`), { status: 413 });
  }
  const cleanHeaders = headers.map((h) => cellToText(h) || '');
  const cleanRows = rows.map((r) => {
    const row = Array.isArray(r) ? r : [];
    return cleanHeaders.map((_, i) => normaliseCell(row[i]));
  });
  return { headers: cleanHeaders, rows: cleanRows };
}

async function loadOwned(id, organizationId) {
  const { rows } = await pool.query(
    'SELECT * FROM imported_sheets WHERE id = $1 AND organization_id = $2',
    [id, organizationId]
  );
  return rows[0] || null;
}

/**
 * POST /spreadsheets/upload — multipart field "file". Uses the same
 * header-detection heuristic as the CSV/XLSX contact importer, picking the
 * sheet/tab with the most usable rows when the workbook has more than one.
 */
router.post('/spreadsheets/upload', canWrite, handleUpload, async (req, res) => {
  try {
    const { sheets } = inspectWorkbook(req.file.buffer, req.file.originalname);
    const usable = sheets.filter((s) => s.headerRowIndex >= 0 && s.rowCount > 0);
    if (!usable.length) {
      return res.status(422).json({ error: 'No sheet in this file has a readable header row and data rows.' });
    }
    const chosen = usable.slice().sort((a, b) => b.rowCount - a.rowCount)[0];

    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false, raw: true, codepage: 65001 });
    const key = wb.SheetNames.find((n) => n === chosen.sheetName) || wb.SheetNames[0];
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[key], { header: 1, raw: true, defval: null, blankrows: false });
    const rawRows = grid.slice(chosen.headerRowIndex + 1)
      .filter((r) => r.some((c) => cellToText(c) !== ''));

    const { headers, rows } = normaliseGrid(chosen.headers, rawRows);

    const name = req.body.name?.trim() || req.file.originalname.replace(/\.(csv|xlsx|xls)$/i, '');
    const { rows: inserted } = await pool.query(
      `INSERT INTO imported_sheets
         (organization_id, name, source, source_ref, headers, rows, created_by)
       VALUES ($1,$2,'upload',$3,$4,$5,$6)
       RETURNING *`,
      [req.user.organizationId, name, req.file.originalname, JSON.stringify(headers), JSON.stringify(rows), req.user.userId]
    );

    logAudit(req, 'spreadsheet.create', { id: inserted[0].id, source: 'upload', rows: rows.length });
    res.status(201).json(toDetail(inserted[0]));
  } catch (err) {
    console.error('[spreadsheets] upload failed', { err: err.message });
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /spreadsheets/from-link — body: { url, name? } */
router.post('/spreadsheets/from-link', canWrite, async (req, res) => {
  const { url } = req.body || {};
  const ref = parseSheetRef(url);
  if (!ref) {
    return res.status(400).json({ error: "That doesn't look like a Google Sheets link." });
  }
  try {
    const { headers: rawHeaders, dataRows, tabTitle } = await fetchSheetGrid(ref.sheetId, ref.gid);
    const { headers, rows } = normaliseGrid(rawHeaders, dataRows);

    const name = req.body.name?.trim() || tabTitle || 'Imported sheet';
    const { rows: inserted } = await pool.query(
      `INSERT INTO imported_sheets
         (organization_id, name, source, source_ref, headers, rows, created_by)
       VALUES ($1,$2,'google_sheets',$3,$4,$5,$6)
       RETURNING *`,
      [req.user.organizationId, name, url, JSON.stringify(headers), JSON.stringify(rows), req.user.userId]
    );

    logAudit(req, 'spreadsheet.create', { id: inserted[0].id, source: 'google_sheets', rows: rows.length });
    res.status(201).json(toDetail(inserted[0]));
  } catch (err) {
    console.error('[spreadsheets] from-link failed', { err: err.message, sheetId: ref.sheetId });
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /spreadsheets — list, most recently updated first. Summaries only
 *  (no headers/rows) so the list stays light even with large sheets saved. */
router.get('/spreadsheets', canRead, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, source, source_ref,
            jsonb_array_length(headers) AS header_count,
            jsonb_array_length(rows) AS row_count,
            last_imported_at, created_at, updated_at
       FROM imported_sheets
      WHERE organization_id = $1
      ORDER BY updated_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    source: r.source,
    sourceRef: r.source_ref,
    columnCount: r.header_count,
    rowCount: r.row_count,
    lastImportedAt: r.last_imported_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

/** GET /spreadsheets/:id — full grid, for opening the editor. */
router.get('/spreadsheets/:id', canRead, async (req, res) => {
  const row = await loadOwned(req.params.id, req.user.organizationId);
  if (!row) return res.status(404).json({ error: 'Spreadsheet not found.' });
  res.json(toDetail(row));
});

/**
 * PUT /spreadsheets/:id — body: { name?, headers?, rows? }
 * Saves edits made in the in-app grid editor. headers/rows must be sent
 * together (a header rename shifts what every row means); name can be
 * sent alone.
 */
router.put('/spreadsheets/:id', canWrite, async (req, res) => {
  const existing = await loadOwned(req.params.id, req.user.organizationId);
  if (!existing) return res.status(404).json({ error: 'Spreadsheet not found.' });

  const { name, headers, rows } = req.body || {};
  const sets = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) return res.status(400).json({ error: 'Name cannot be empty.' });
    sets.push(`name = $${i++}`);
    values.push(trimmed);
  }
  if (headers !== undefined || rows !== undefined) {
    if (headers === undefined || rows === undefined) {
      return res.status(400).json({ error: 'headers and rows must be sent together.' });
    }
    let clean;
    try {
      clean = normaliseGrid(headers, rows);
    } catch (err) {
      return res.status(err.status || 422).json({ error: err.message });
    }
    sets.push(`headers = $${i++}`, `rows = $${i++}`);
    values.push(JSON.stringify(clean.headers), JSON.stringify(clean.rows));
  }
  if (!sets.length) {
    return res.status(400).json({ error: 'Nothing to update — send name and/or headers+rows.' });
  }

  sets.push('updated_at = now()');
  values.push(req.params.id, req.user.organizationId);
  const { rows: updated } = await pool.query(
    `UPDATE imported_sheets SET ${sets.join(', ')}
      WHERE id = $${i++} AND organization_id = $${i}
      RETURNING *`,
    values
  );

  logAudit(req, 'spreadsheet.update', { id: req.params.id });
  res.json(toDetail(updated[0]));
});

/** DELETE /spreadsheets/:id */
router.delete('/spreadsheets/:id', canDelete, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM imported_sheets WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.user.organizationId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Spreadsheet not found.' });
  logAudit(req, 'spreadsheet.delete', { id: req.params.id });
  res.status(204).end();
});

/**
 * POST /spreadsheets/:id/import — body: { mapping, defaultSource?,
 *   onDuplicate?, unmappedToNotes? }
 * Imports whatever is CURRENTLY saved for this spreadsheet — so editing a
 * cell in the grid editor and re-importing picks up the edit — through the
 * same transactional dedupe/write path as the CSV/XLSX and Sheets-link
 * importers.
 */
router.post('/spreadsheets/:id/import', canWrite, async (req, res) => {
  const sheet = await loadOwned(req.params.id, req.user.organizationId);
  if (!sheet) return res.status(404).json({ error: 'Spreadsheet not found.' });

  const { mapping } = req.body || {};
  if (!mapping || !Object.keys(mapping).length) {
    return res.status(400).json({ error: 'No column mapping supplied — nothing would be imported.' });
  }
  const onDuplicate = req.body.onDuplicate === 'update' ? 'update' : 'skip';

  const { records, issues, stats } = buildRecords({
    headers: sheet.headers,
    rows: sheet.rows,
    mapping,
    options: {
      defaultSource: req.body.defaultSource || null,
      unmappedToNotes: req.body.unmappedToNotes !== false && req.body.unmappedToNotes !== 'false',
      sheetName: sheet.name,
    },
  });
  const { unique, duplicates } = markInFileDuplicates(records);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { result, failures } = await writeContacts(client, req.user.organizationId, unique, onDuplicate);
    result.skipped += stats.skipped + duplicates.length;
    await client.query(
      'UPDATE imported_sheets SET last_imported_at = now() WHERE id = $1',
      [sheet.id]
    );
    await client.query('COMMIT');

    logAudit(req, 'spreadsheet.import', { id: sheet.id, ...result });
    console.log('[spreadsheets] import done', { org: req.user.organizationId, id: sheet.id, ...result });

    res.status(201).json({
      spreadsheetId: sheet.id,
      ...result,
      issues: [...issues, ...duplicates, ...failures].slice(0, 500),
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[spreadsheets] import failed', { err: err.message, id: sheet.id });
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;