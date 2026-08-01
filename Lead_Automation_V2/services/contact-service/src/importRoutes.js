/**
 * src/importRoutes.js
 *
 * CSV/XLSX contact import, mounted by index.js. Two steps so the user commits
 * to a mapping before anything is written:
 *
 *   POST /contacts/import/preview  -> inspect the file, suggest a mapping,
 *                                     report what would happen. Writes nothing.
 *   POST /contacts/import          -> perform the import with a confirmed
 *                                     mapping, inside one transaction.
 *
 * Both take the file as multipart/form-data field "file". Parsing happens in
 * memory (no temp files on disk) and is size-capped.
 */

const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool, requirePermission, logAudit } = require('@lead/shared');

const {
  inspectWorkbook, buildRecords, markInFileDuplicates, cellToText,
} = require('./importer');

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS_PER_IMPORT = 20000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(csv|xlsx|xls)$/i.test(file.originalname)) return cb(null, true);
    cb(Object.assign(new Error('Only .csv, .xlsx, and .xls files are supported.'), { status: 400 }));
  },
});

/**
 * Sheet names in real exports frequently carry trailing spaces ("July DM and
 * JD leads "), which survive in the workbook but get trimmed in transit, so
 * match on the trimmed name rather than requiring an exact string.
 */
function findSheet(sheets, requested) {
  if (!requested) return null;
  const want = String(requested).trim();
  return sheets.find((s) => s.sheetName === requested)
      || sheets.find((s) => s.sheetName.trim() === want)
      || null;
}

const router = express.Router();
const canWrite = requirePermission('contacts:write');

/** Re-reads one sheet's data rows using the header row the inspector found. */
function readSheetRows(buffer, filename, sheetName, headerRowIndex) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true, codepage: 65001 });
  const key = wb.SheetNames.find((n) => n === sheetName)
    || wb.SheetNames.find((n) => n.trim() === String(sheetName).trim());
  const ws = key ? wb.Sheets[key] : null;
  if (!ws) {
    throw Object.assign(new Error(`Sheet "${sheetName}" not found in the uploaded file.`), { status: 400 });
  }
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  const headers = (grid[headerRowIndex] || []).map(cellToText);
  const rows = grid.slice(headerRowIndex + 1).filter((r) => r.some((c) => cellToText(c) !== ''));
  return { headers, rows };
}

/** Shared multer error surface — without this a too-large file 500s. */
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

/**
 * POST /contacts/import/preview
 * Returns every sheet with its detected headers, suggested mapping, sample
 * rows, and — for the chosen sheet — the full validation report.
 */
router.post('/contacts/import/preview', canWrite, handleUpload, async (req, res) => {
  try {
    const { sheets } = inspectWorkbook(req.file.buffer, req.file.originalname);
    const usableSheets = sheets.filter((s) => s.headerRowIndex >= 0 && s.rowCount > 0);
    if (!usableSheets.length) {
      return res.status(422).json({ error: 'No sheet in this file has a readable header row and data rows.' , sheets });
    }

    // Default to the sheet with the most rows that maps at least a name or a
    // contact method — for these exports that skips the pivot/summary tab.
    const requested = req.body.sheetName;
    const scored = usableSheets
      .map((s) => {
        const fields = new Set(Object.values(s.suggestedMapping));
        const usable = fields.has('name') || fields.has('email') || fields.has('phone');
        return { s, usable };
      })
      .sort((a, b) => (b.usable - a.usable) || (b.s.rowCount - a.s.rowCount));

    const chosen = requested ? findSheet(usableSheets, requested) : scored[0].s;
    if (!chosen) return res.status(400).json({ error: `Sheet "${requested}" not found.` });

    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : chosen.suggestedMapping;
    const { headers, rows } = readSheetRows(req.file.buffer, req.file.originalname, chosen.sheetName, chosen.headerRowIndex);

    if (rows.length > MAX_ROWS_PER_IMPORT) {
      return res.status(413).json({ error: `Sheet has ${rows.length} rows; the limit is ${MAX_ROWS_PER_IMPORT} per import.` });
    }

    const { records, issues, stats } = buildRecords({
      headers, rows, mapping,
      options: {
        defaultSource: req.body.defaultSource || null,
        unmappedToNotes: req.body.unmappedToNotes !== 'false',
        sheetName: req.body.tagWithSheetName === 'false' ? null : chosen.sheetName,
      },
    });
    const { unique, duplicates } = markInFileDuplicates(records);

    // How many of the remaining rows already exist for this org?
    const existing = await countExisting(req.user.organizationId, unique);

    res.json({
      filename: req.file.originalname,
      sheets: sheets.map(({ sheetName, headers: h, rowCount, suggestedMapping, headerRowIndex, sampleRows }) =>
        ({ sheetName, headers: h, rowCount, suggestedMapping, headerRowIndex, sampleRows })),
      selectedSheet: chosen.sheetName,
      headers,
      mapping,
      stats: {
        ...stats,
        duplicatesInFile: duplicates.length,
        alreadyInDatabase: existing.matched,
        willInsert: unique.length - existing.matched,
      },
      issues: [...issues, ...duplicates].slice(0, 200),
      previewRecords: unique.slice(0, 10),
    });
  } catch (err) {
    console.error('[contact-import] preview failed', { err: err.message, file: req.file?.originalname });
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Counts how many candidate records already exist, matched on phone or email. */
async function countExisting(organizationId, records) {
  const phones = records.map((r) => r.phone).filter(Boolean);
  const emails = records.map((r) => r.email).filter(Boolean);
  if (!phones.length && !emails.length) return { matched: 0, phones: new Set(), emails: new Set() };

  const { rows } = await pool.query(
    `SELECT phone, lower(email) AS email FROM contacts
      WHERE organization_id = $1
        AND (phone = ANY($2::text[]) OR lower(email) = ANY($3::text[]))`,
    [organizationId, phones, emails.map((e) => e.toLowerCase())]
  );
  const existingPhones = new Set(rows.map((r) => r.phone).filter(Boolean));
  const existingEmails = new Set(rows.map((r) => r.email).filter(Boolean));

  let matched = 0;
  for (const r of records) {
    if ((r.phone && existingPhones.has(r.phone)) || (r.email && existingEmails.has(r.email.toLowerCase()))) matched++;
  }
  return { matched, phones: existingPhones, emails: existingEmails };
}

/**
 * POST /contacts/import
 * Body (multipart): file, sheetName, mapping (JSON), defaultSource,
 *                   onDuplicate = skip | update, unmappedToNotes, tagWithSheetName
 */
router.post('/contacts/import', canWrite, handleUpload, async (req, res) => {
  const onDuplicate = req.body.onDuplicate === 'update' ? 'update' : 'skip';
  const client = await pool.connect();
  try {
    const { sheets } = inspectWorkbook(req.file.buffer, req.file.originalname);
    const chosen = req.body.sheetName
      ? findSheet(sheets, req.body.sheetName)
      : sheets.filter((s) => s.headerRowIndex >= 0 && s.rowCount > 0).sort((a, b) => b.rowCount - a.rowCount)[0];

    if (!chosen || chosen.headerRowIndex < 0) {
      return res.status(400).json({ error: 'Could not determine which sheet to import. Pass sheetName.' });
    }

    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : chosen.suggestedMapping;
    if (!Object.keys(mapping).length) {
      return res.status(400).json({ error: 'No column mapping supplied — nothing would be imported.' });
    }

    const { headers, rows } = readSheetRows(req.file.buffer, req.file.originalname, chosen.sheetName, chosen.headerRowIndex);
    if (rows.length > MAX_ROWS_PER_IMPORT) {
      return res.status(413).json({ error: `Sheet has ${rows.length} rows; the limit is ${MAX_ROWS_PER_IMPORT} per import.` });
    }

    const { records, issues, stats } = buildRecords({
      headers, rows, mapping,
      options: {
        defaultSource: req.body.defaultSource || null,
        unmappedToNotes: req.body.unmappedToNotes !== 'false',
        sheetName: req.body.tagWithSheetName === 'false' ? null : chosen.sheetName,
      },
    });
    const { unique, duplicates } = markInFileDuplicates(records);

    const result = { inserted: 0, updated: 0, skipped: stats.skipped + duplicates.length, failed: 0 };
    const failures = [];

    await client.query('BEGIN');
    for (const rec of unique) {
      try {
        // Match an existing contact on either reachable identity.
        // Phone/email are the real identities. For rows that carry neither,
        // fall back to name+source so re-running the same import does not
        // duplicate them on every pass.
        const { rows: found } = rec.phone || rec.email
          ? await client.query(
            `SELECT id FROM contacts
              WHERE organization_id = $1
                AND ( ($2::text IS NOT NULL AND phone = $2)
                   OR ($3::text IS NOT NULL AND lower(email) = lower($3)) )
              LIMIT 1`,
            [req.user.organizationId, rec.phone, rec.email]
          )
          : await client.query(
            `SELECT id FROM contacts
              WHERE organization_id = $1 AND name IS NOT DISTINCT FROM $2
                AND source IS NOT DISTINCT FROM $3
              LIMIT 1`,
            [req.user.organizationId, rec.name, rec.source]
          );

        if (found.length) {
          if (onDuplicate === 'update') {
            // COALESCE so an empty cell in the sheet never blanks existing data.
            await client.query(
              `UPDATE contacts SET
                 name   = COALESCE($2, name),
                 email  = COALESCE($3, email),
                 phone  = COALESCE($4, phone),
                 source = COALESCE($5, source),
                 notes  = COALESCE($6, notes),
                 tags   = (SELECT ARRAY(SELECT DISTINCT unnest(tags || $7::text[])))
               WHERE id = $1`,
              [found[0].id, rec.name, rec.email, rec.phone, rec.source, rec.notes, rec.tags]
            );
            result.updated++;
          } else {
            result.skipped++;
          }
          continue;
        }

        await client.query(
          `INSERT INTO contacts (organization_id, name, email, phone, source, notes, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [req.user.organizationId, rec.name, rec.email, rec.phone, rec.source, rec.notes, rec.tags]
        );
        result.inserted++;
      } catch (rowErr) {
        // One malformed row must not lose the rest of the import.
        result.failed++;
        failures.push({ rowNumber: rec.rowNumber, level: 'error', message: rowErr.message });
        console.error('[contact-import] row failed', { row: rec.rowNumber, err: rowErr.message });
      }
    }
    await client.query('COMMIT');

    logAudit(req, 'contact.import', {
      file: req.file.originalname,
      sheet: chosen.sheetName,
      ...result,
    });
    console.log('[contact-import] done', { org: req.user.organizationId, file: req.file.originalname, sheet: chosen.sheetName, ...result });

    res.status(201).json({
      filename: req.file.originalname,
      sheet: chosen.sheetName,
      ...result,
      issues: [...issues, ...duplicates, ...failures].slice(0, 500),
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[contact-import] import failed', { err: err.message, file: req.file?.originalname });
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
