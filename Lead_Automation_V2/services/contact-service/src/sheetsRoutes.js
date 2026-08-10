/**
 * src/sheetsRoutes.js
 *
 * Google Sheets -> CRM import (Support Agent "Import" tab), two steps so a
 * user commits to a column mapping before anything is written — same shape
 * as the CSV/XLSX importer in importRoutes.js:
 *
 *   POST /sheets/preview -> fetch the sheet, detect headers, suggest a
 *                           mapping, report what would happen. Writes nothing.
 *   POST /sheets/import  -> perform the import with a confirmed mapping,
 *                           inside one transaction. Requires contacts:write.
 *
 * Sheet fetching itself (URL parsing, service-account vs public-CSV) lives
 * in sheetFetcher.js, shared with spreadsheetsRoutes.js (the saved/editable
 * spreadsheets feature) so both read a Google Sheet the same way.
 */
const express = require('express');
const { pool, requirePermission, logAudit } = require('@lead/shared');
const {
  cellToText, suggestMapping, buildRecords, markInFileDuplicates,
} = require('./importer');
const { writeContacts, countExisting } = require('./contactWriter');
const { getServiceAccountEmail } = require('./googleAuth');
const { parseSheetRef, fetchSheetGrid } = require('./sheetFetcher');

const router = express.Router();
const canWrite = requirePermission('contacts:write');

const MAX_ROWS = 20000; // import cap, same order of magnitude as the file importer
const PREVIEW_ROWS = 500; // /sheets/preview truncates its raw preview payload to this

/**
 * POST /sheets/preview — body: { url, mapping?, defaultSource?, unmappedToNotes? }
 * Fetches the sheet, suggests (or uses the given) mapping, and returns a
 * dry-run report — same shape as POST /contacts/import/preview. Writes nothing.
 */
router.post('/sheets/preview', canWrite, async (req, res) => {
  const { url } = req.body || {};
  const ref = parseSheetRef(url);
  if (!ref) {
    return res.status(400).json({
      error: "That doesn't look like a Google Sheets link. Paste a docs.google.com/spreadsheets URL (or just the sheet ID).",
    });
  }

  let headers;
  let dataRows;
  let tabTitle;
  try {
    ({ headers, dataRows, tabTitle } = await fetchSheetGrid(ref.sheetId, ref.gid));
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }

  if (dataRows.length > MAX_ROWS) {
    return res.status(413).json({ error: `Sheet has ${dataRows.length} rows; the limit is ${MAX_ROWS} per import.` });
  }

  const mapping = req.body.mapping || suggestMapping(headers);
  const rows = dataRows.map((r) => headers.map((_, i) => r[i]));

  const { records, issues, stats } = buildRecords({
    headers, rows, mapping,
    options: {
      defaultSource: req.body.defaultSource || null,
      unmappedToNotes: req.body.unmappedToNotes !== false && req.body.unmappedToNotes !== 'false',
      sheetName: req.body.tagWithSheetName === false || req.body.tagWithSheetName === 'false' ? null : tabTitle,
    },
  });
  const { unique, duplicates } = markInFileDuplicates(records);
  const existing = await countExisting(pool, req.user.organizationId, unique);

  res.json({
    sheetTitle: tabTitle,
    headers,
    mapping,
    rowCount: dataRows.length,
    truncated: dataRows.length > PREVIEW_ROWS,
    rawPreviewRows: rows.slice(0, PREVIEW_ROWS).map((r) => r.map(cellToText)),
    stats: {
      ...stats,
      duplicatesInFile: duplicates.length,
      alreadyInDatabase: existing.matched,
      willInsert: unique.length - existing.matched,
    },
    issues: [...issues, ...duplicates].slice(0, 200),
    previewRecords: unique.slice(0, 10),
    serviceAccountEmail: getServiceAccountEmail(),
  });
});

/**
 * POST /sheets/import — body: { url, mapping, defaultSource?, onDuplicate?,
 *                                unmappedToNotes?, tagWithSheetName? }
 * Re-fetches the sheet (never trusts client-echoed row data) and writes
 * through the same transactional path as the CSV/XLSX importer.
 */
router.post('/sheets/import', canWrite, async (req, res) => {
  const { url, mapping } = req.body || {};
  const ref = parseSheetRef(url);
  if (!ref) {
    return res.status(400).json({ error: "That doesn't look like a Google Sheets link." });
  }
  if (!mapping || !Object.keys(mapping).length) {
    return res.status(400).json({ error: 'No column mapping supplied — nothing would be imported.' });
  }
  const onDuplicate = req.body.onDuplicate === 'update' ? 'update' : 'skip';

  let headers;
  let dataRows;
  let tabTitle;
  try {
    ({ headers, dataRows, tabTitle } = await fetchSheetGrid(ref.sheetId, ref.gid));
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
  if (dataRows.length > MAX_ROWS) {
    return res.status(413).json({ error: `Sheet has ${dataRows.length} rows; the limit is ${MAX_ROWS} per import.` });
  }

  const rows = dataRows.map((r) => headers.map((_, i) => r[i]));
  const { records, issues, stats } = buildRecords({
    headers, rows, mapping,
    options: {
      defaultSource: req.body.defaultSource || null,
      unmappedToNotes: req.body.unmappedToNotes !== false && req.body.unmappedToNotes !== 'false',
      sheetName: req.body.tagWithSheetName === false || req.body.tagWithSheetName === 'false' ? null : tabTitle,
    },
  });
  const { unique, duplicates } = markInFileDuplicates(records);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { result, failures } = await writeContacts(client, req.user.organizationId, unique, onDuplicate);
    result.skipped += stats.skipped + duplicates.length;
    await client.query('COMMIT');

    logAudit(req, 'contact.import', {
      source: 'google_sheets',
      sheetId: ref.sheetId,
      sheet: tabTitle,
      ...result,
    });
    console.log('[sheets-import] done', {
      org: req.user.organizationId, sheetId: ref.sheetId, sheet: tabTitle, ...result,
    });

    res.status(201).json({
      sheetId: ref.sheetId,
      sheet: tabTitle,
      ...result,
      issues: [...issues, ...duplicates, ...failures].slice(0, 500),
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[sheets-import] import failed', { err: err.message, sheetId: ref.sheetId });
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;