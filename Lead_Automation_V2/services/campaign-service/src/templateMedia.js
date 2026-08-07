// src/templateMedia.js
//
// Handles image (and, per the schema, video/document) header uploads for
// the Template Creator's dropzone (frontend/src/components/campaigns/
// templates/TemplateEditor.jsx). Same shape as automation-service's
// mediaController.js — multipart/form-data straight to disk, a public URL
// handed back for the WhatsApp live preview and, later, for Meta's
// template-submission API to fetch.
//
// Storage is local disk, same caveat as mediaController.js: set
// GATEWAY_PUBLIC_URL once the api-gateway has a real public hostname, or
// swap in multer-s3 once you're running more than one replica. The
// returned URL is rooted at the gateway (see below), not at this
// service's own port, so it resolves for any client — the browser
// included — that only ever talks to the gateway.

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const router = express.Router();

const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB — WhatsApp's own header-image cap is 5 MB, leave headroom for video/doc later

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'templates');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/3gpp',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MEDIA_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`Unsupported header media type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// POST /templates/media/upload  (multipart/form-data, field name "file")
// Mounted behind `authenticate` in index.js.
router.post('/templates/media/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds the 10 MB limit.' });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file received (expected form field "file").' });
    }

    // NOTE: this used to build the URL against campaign-service's own
    // port (CAMPAIGN_PUBLIC_URL / CAMPAIGN_PORT), which only resolves if
    // the browser can reach that service directly. The frontend's fetch
    // helper (frontend/src/lib/api.js) always talks to the api-gateway
    // (NEXT_PUBLIC_API_URL, default http://localhost:8080) — not to
    // individual services — so a campaign-service-rooted URL 404s/fails
    // to load in the Live Preview whenever the gateway is the only origin
    // actually reachable from the browser. GATEWAY_PUBLIC_URL is the same
    // convention integration-service/src/routes/smsDevices.js already
    // uses for exactly this "the browser needs to fetch this asset"
    // case; api-gateway/src/index.js proxies /uploads through to this
    // service so the resulting URL resolves.
    const publicBase =
      process.env.GATEWAY_PUBLIC_URL || `http://localhost:${process.env.GATEWAY_PORT || 8080}`;
    const url = `${publicBase}/uploads/templates/${req.file.filename}`;

    res.status(201).json({
      url,
      filename: req.file.originalname,
      sizeBytes: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

module.exports = router;
