// services/automation-service/src/controllers/mediaController.js
//
// Handles document uploads for the Message Node's "document" type
// (frontend/src/components/automation/FlowBuilder.jsx). Files are received
// as multipart/form-data — never as base64-in-JSON, which would (a) blow
// past express.json()'s body limit and (b) cost ~33% size overhead for no
// reason — validated, and written to disk so a public URL can be handed to
// buildSendTemplate()/whatsappSender.js, which expects
// data.document = { url, filename } (see src/schemas/flow-schema.md).
//
// Storage is local disk by default — fine for a single-instance deploy
// behind the api-gateway. IMPORTANT: the WhatsApp Cloud API fetches this
// URL itself from Meta's servers, so it must be a *publicly reachable*
// URL, not http://localhost. Set AUTOMATION_PUBLIC_URL once this service
// has a real public hostname, or swap the storage engine below for
// multer-s3 + @aws-sdk/client-s3 (needed anyway once you run more than one
// automation-service replica, since local disk isn't shared across them).

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const router = express.Router();

// Keep this in sync with the client-side check in FlowBuilder.jsx.
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'documents');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// WhatsApp Cloud API's supported document types (Meta's official list is
// slightly broader; this covers the common business-document cases).
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Never trust/reuse the original filename on disk (path traversal,
    // collisions) — keep it only as `originalname` in the response so the
    // node badge can still display "filename.pdf" to the user.
    const safeExt = path.extname(file.originalname).slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_DOCUMENT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`Unsupported document type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// POST /automation/media/upload  (multipart/form-data, field name "document")
// Mounted behind `authenticate` in index.js — only logged-in CRM users can upload.
router.post('/automation/media/upload', (req, res) => {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds the 20 MB limit.' });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file received (expected form field "document").' });
    }

    // In prod, set AUTOMATION_PUBLIC_URL to this service's real public
    // hostname (or the api-gateway's, if you proxy /uploads through it too).
    const publicBase =
      process.env.AUTOMATION_PUBLIC_URL ||
      `http://localhost:${process.env.AUTOMATION_PORT || process.env.PORT || 4011}`;
    const url = `${publicBase}/uploads/documents/${req.file.filename}`;

    res.status(201).json({
      url,
      filename: req.file.originalname,
      sizeBytes: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

module.exports = router;