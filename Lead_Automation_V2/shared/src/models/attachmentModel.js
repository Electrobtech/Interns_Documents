// shared/src/models/attachmentModel.js
//
// Media/image attachment metadata (Postgres — see the comment in
// 021_super_admin_billing.sql for why this isn't MongoDB). File bytes
// are expected to be stored the same way organizations.logo_url is
// handled elsewhere in this repo (multer to disk/object storage), this
// table just tracks the resulting URL + ownership.

const { pool } = require('../db');

async function create({ organizationId, ownerType, ownerId, fileUrl, mimeType, sizeBytes, uploadedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO attachments
       (organization_id, owner_type, owner_id, file_url, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [organizationId, ownerType, ownerId, fileUrl, mimeType || null, sizeBytes || null, uploadedBy || null]
  );
  return rows[0];
}

async function listForOwner(organizationId, ownerType, ownerId) {
  const { rows } = await pool.query(
    `SELECT * FROM attachments
      WHERE organization_id = $1 AND owner_type = $2 AND owner_id = $3
      ORDER BY created_at DESC`,
    [organizationId, ownerType, ownerId]
  );
  return rows;
}

module.exports = { create, listForOwner };
