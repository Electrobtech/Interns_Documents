/**
 * src/services/attachmentStorage.js
 *
 * Local-disk object storage for email attachments — same approach as
 * automation-service/src/controllers/mediaController.js and
 * auth-service's /uploads (see docker-compose.yml's automation_uploads /
 * auth_uploads volumes): fine for a single-instance deploy behind the
 * api-gateway. Swap for S3/R2 (multer-s3 + @aws-sdk/client-s3, or upload
 * the Gmail attachment bytes straight to a bucket in downloadAttachment
 * below) once this needs to run more than one replica — the DB only ever
 * stores a URL, so callers don't need to change either way.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'attachments');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function publicBaseUrl() {
  return (
    process.env.EMAIL_PUBLIC_URL ||
    `http://localhost:${process.env.EMAIL_PORT || 4013}`
  );
}

/** Writes a Buffer to disk under a random filename and returns its public URL. */
function saveBuffer(buffer, originalFilename) {
  const safeExt = path.extname(originalFilename || '').slice(0, 12);
  const diskName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, diskName), buffer);
  return `${publicBaseUrl()}/uploads/attachments/${diskName}`;
}

module.exports = { UPLOAD_DIR, saveBuffer, publicBaseUrl };
