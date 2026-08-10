// src/assets.js
//
// Marketing Hub Assets Library — multipart upload + list + delete.
// Storage mirrors campaign-service/src/templateMedia.js and
// automation-service mediaController.js: multer → local disk under
// public/uploads/marketing-assets, public URL rooted at GATEWAY_PUBLIC_URL
// so the browser (which only talks to the api-gateway) can fetch the file.
//
// Mounted behind `authenticate` in index.js.

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { pool } = require('@lead/shared');

const router = express.Router();

const MAX_ASSET_BYTES = 50 * 1024 * 1024; // 50 MB — logos/images/PDFs/short video

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'marketing-assets');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf',
]);

// Map MIME → Assets Library type enum (matches schema CHECK + frontend tabs)
function typeFromMime(mime, originalName) {
  if (!mime) return 'Images';
  if (mime.startsWith('video/')) return 'Videos';
  if (mime === 'application/pdf') return 'PDFs';
  if (mime.startsWith('image/')) {
    const lower = (originalName || '').toLowerCase();
    if (lower.includes('logo') || lower.includes('brand')) return 'Logos';
    return 'Images';
  }
  return 'Images';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_ASSET_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`Unsupported asset type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// GET /marketing-hub/assets?type=
router.get('/marketing-hub/assets', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { type } = req.query;
    let sql = `
      SELECT id, name, type, size_bytes, storage_url, mime_type,
             uploaded_by, created_at, updated_at
        FROM marketing_assets
       WHERE organization_id = $1
    `;
    const params = [orgId];
    if (type && type !== 'All') {
      // Frontend tab "AI Generated" maps to stored type "AI Generated Images"
      const resolved =
        type === 'AI Generated' ? 'AI Generated Images' : type;
      sql += ` AND type = $2`;
      params.push(resolved);
    }
    sql += ` ORDER BY created_at DESC LIMIT 500`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[marketing-hub] list assets', err);
    res.status(500).json({ error: err.message || 'Failed to list assets' });
  }
});

// POST /marketing-hub/assets  (multipart/form-data, field name "file")
// Optional form field "type" overrides MIME-derived type (e.g. "AI Generated Images", "Logos")
router.post('/marketing-hub/assets', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds the 50 MB limit.' });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file received (expected form field "file").' });
    }

    try {
      const orgId = req.user.organizationId;
      const userId = req.user.userId || req.user.id || null;
      const allowedTypes = new Set([
        'Logos', 'Images', 'Videos', 'PDFs', 'AI Generated Images',
      ]);
      let assetType = (req.body && req.body.type) || typeFromMime(req.file.mimetype, req.file.originalname);
      if (!allowedTypes.has(assetType)) {
        assetType = typeFromMime(req.file.mimetype, req.file.originalname);
      }

      const publicBase =
        process.env.GATEWAY_PUBLIC_URL ||
        `http://localhost:${process.env.GATEWAY_PORT || 8080}`;
      const storageUrl = `${publicBase}/uploads/marketing-assets/${req.file.filename}`;

      const { rows } = await pool.query(
        `INSERT INTO marketing_assets
           (organization_id, name, type, size_bytes, storage_url, mime_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, type, size_bytes, storage_url, mime_type,
                   uploaded_by, created_at, updated_at`,
        [
          orgId,
          req.file.originalname,
          assetType,
          req.file.size,
          storageUrl,
          req.file.mimetype,
          userId,
        ]
      );

      res.status(201).json(rows[0]);
    } catch (e) {
      // Clean up the orphan file if the DB insert fails
      try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
      console.error('[marketing-hub] upload asset', e);
      res.status(500).json({ error: e.message || 'Failed to save asset' });
    }
  });
});

// DELETE /marketing-hub/assets/:id
router.delete('/marketing-hub/assets/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { rows } = await pool.query(
      `DELETE FROM marketing_assets
        WHERE id = $1 AND organization_id = $2
        RETURNING id, storage_url, name`,
      [req.params.id, orgId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Best-effort disk cleanup — URL ends with /uploads/marketing-assets/<filename>
    const filename = path.basename(rows[0].storage_url || '');
    if (filename && !filename.includes('..')) {
      const diskPath = path.join(UPLOAD_DIR, filename);
      try { fs.unlinkSync(diskPath); } catch (_) { /* file may already be gone */ }
    }

    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('[marketing-hub] delete asset', err);
    res.status(500).json({ error: err.message || 'Failed to delete asset' });
  }
});

module.exports = router;
