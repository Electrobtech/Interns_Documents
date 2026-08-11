const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { pool, requirePermission, logAudit } = require('@lead/shared');

const router = express.Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const canRead  = requirePermission('campaigns:read');
const canWrite = requirePermission('campaigns:write');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/assets');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|pdf|doc|docx|mp3|wav|zip/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

function getFileType(mimetype = '') {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

// GET /assets — list all assets for the current org
router.get('/', canRead, ah(async (req, res) => {
  const { type, tags, search, limit = 50, offset = 0 } = req.query;
  const orgId = req.user.organizationId;

  let q = 'SELECT * FROM mh_assets WHERE organization_id=$1';
  const params = [orgId];

  if (type) {
    params.push(type);
    q += ` AND file_type=$${params.length}`;
  }
  if (tags) {
    params.push(tags.split(','));
    q += ` AND tags && $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    q += ` AND name ILIKE $${params.length}`;
  }

  params.push(parseInt(limit, 10), parseInt(offset, 10));
  q += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await pool.query(q, params);
  res.json(rows);
}));

// POST /assets — upload a new asset and save to DB
router.post('/', canWrite, upload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { name, type, tags, metadata } = req.body;
  const orgId = req.user.organizationId;
  const fileUrl = `uploads/assets/${req.file.filename}`;

  const { rows } = await pool.query(
    `INSERT INTO mh_assets (organization_id, name, file_type, file_url, file_size, tags, metadata, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      orgId,
      name || req.file.originalname,
      type || getFileType(req.file.mimetype),
      fileUrl,
      req.file.size,
      tags ? tags.split(',') : [],
      metadata ? JSON.parse(metadata) : {},
      req.user.userId || null,
    ]
  );

  logAudit(req, 'mh_asset.upload', { id: rows[0].id, name: rows[0].name });
  res.status(201).json(rows[0]);
}));

// GET /assets/stats/overview — type breakdown
router.get('/stats/overview', canRead, ah(async (req, res) => {
  const orgId = req.user.organizationId;
  const { rows } = await pool.query(
    `SELECT file_type, COUNT(*) AS count, COALESCE(SUM(file_size),0) AS total_size
       FROM mh_assets WHERE organization_id=$1 GROUP BY file_type`,
    [orgId]
  );
  const stats = {
    total: rows.reduce((s, r) => s + parseInt(r.count, 10), 0),
    total_size: rows.reduce((s, r) => s + parseInt(r.total_size, 10), 0),
    by_type: rows.reduce((acc, r) => {
      acc[r.file_type] = { count: parseInt(r.count, 10), size: parseInt(r.total_size, 10) };
      return acc;
    }, {}),
  };
  res.json(stats);
}));

// GET /assets/:id
router.get('/:id', canRead, ah(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM mh_assets WHERE id=$1 AND organization_id=$2',
    [req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// PUT /assets/:id — rename / retag
router.put('/:id', canWrite, ah(async (req, res) => {
  const { name, tags, metadata } = req.body;
  const { rows } = await pool.query(
    `UPDATE mh_assets SET name=COALESCE($1,name), tags=COALESCE($2,tags),
        metadata=COALESCE($3,metadata), updated_at=now()
      WHERE id=$4 AND organization_id=$5 RETURNING *`,
    [name, tags || null, metadata || null, req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  logAudit(req, 'mh_asset.update', { id: req.params.id, changes: { name } });
  res.json(rows[0]);
}));

// DELETE /assets/:id
router.delete('/:id', canWrite, ah(async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM mh_assets WHERE id=$1 AND organization_id=$2 RETURNING file_url',
    [req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  // Best-effort disk cleanup
  try {
    const abs = path.join(__dirname, '../../../', rows[0].file_url);
    await fs.unlink(abs);
  } catch { /* ignore if already gone */ }
  logAudit(req, 'mh_asset.delete', { id: req.params.id });
  res.json({ ok: true });
}));

// GET /assets/:id/file — stream raw file bytes
router.get('/:id/file', canRead, ah(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT file_url, name FROM mh_assets WHERE id=$1 AND organization_id=$2',
    [req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });

  const abs = path.isAbsolute(rows[0].file_url)
    ? rows[0].file_url
    : path.join(__dirname, '../../../', rows[0].file_url);

  try { await fs.access(abs); } catch {
    return res.status(404).json({ error: 'File not found on disk' });
  }
  res.sendFile(path.resolve(abs));
}));

module.exports = router;