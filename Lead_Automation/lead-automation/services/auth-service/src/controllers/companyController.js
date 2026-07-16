// services/auth-service/src/controllers/companyController.js
//
// Company Registration (Tenant Onboarding) — the 7-step wizard in
// frontend/src/app/register submits its whole payload to POST
// /auth/register/company in one shot. Everything below reuses the same
// `organizations` + `users` tables and `authenticate` middleware as the
// rest of the app; it does not introduce a parallel tenant model.

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { pool, sign, authenticate } = require('@lead/shared');
const {
  validateCompanyRegistration,
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
} = require('../validators');

const router = express.Router();

// ---------------------------------------------------------------------
// POST /auth/register/company — Step 7 "Create Company" submit.
// Creates the tenant (organizations row) + the Account Owner (users row,
// role 'owner') in a single transaction, exactly like the existing
// /auth/register but with the full wizard payload.
// ---------------------------------------------------------------------
router.post('/auth/register/company', async (req, res) => {
  const errors = validateCompanyRegistration(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const { owner, company, contact, address, verification, subscription } = req.body;
  const slug = company.companyName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Duplicate checks up front so we can return field-specific errors
    // instead of a generic 23505 constraint-violation message.
    const dupCompany = await client.query(
      `SELECT id FROM organizations WHERE lower(name) = lower($1) OR slug = $2`,
      [company.companyName.trim(), slug]
    );
    if (dupCompany.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Validation failed', details: [{ field: 'company.companyName', message: 'A company with this name is already registered' }] });
    }
    const dupEmail = await client.query(`SELECT id FROM users WHERE email = $1`, [owner.workEmail.trim().toLowerCase()]);
    if (dupEmail.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Validation failed', details: [{ field: 'owner.workEmail', message: 'This email is already registered' }] });
    }

    const org = await client.query(
      `INSERT INTO organizations (
         name, slug, legal_name, business_type, industry, website, logo_url,
         employee_count, description, company_email, company_phone,
         support_email, alternate_phone, address_line1, address_line2, city,
         state, country, postal_code, gst_number, pan_number,
         registration_number, incorporation_cert_url, gst_cert_url,
         registration_cert_url, subscription_plan, coupon_code, status,
         onboarding_step
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20,$21,$22,$23,$24,$25,$26,$27,'active',7
       ) RETURNING id`,
      [
        company.companyName.trim(), slug, company.legalName || null, company.businessType,
        company.industry, company.website || null, company.logoUrl || null,
        company.employeeCount || null, company.description || null,
        contact.companyEmail.trim().toLowerCase(), contact.companyPhone.trim(),
        contact.supportEmail || null, contact.alternatePhone || null,
        address.line1.trim(), address.line2 || null, address.city.trim(),
        address.state.trim(), address.country.trim(), address.postalCode.trim(),
        verification.gstNumber || null, verification.panNumber || null,
        verification.registrationNumber || null,
        verification.incorporationCertUrl || null, verification.gstCertUrl || null,
        verification.registrationCertUrl || null,
        subscription.plan, subscription.couponCode || null,
      ]
    );
    const organizationId = org.rows[0].id;

    const roleRow = await client.query(`SELECT id FROM roles WHERE name = 'owner'`);
    const hash = await bcrypt.hash(owner.password, 10);
    const user = await client.query(
      `INSERT INTO users (
         organization_id, role_id, name, email, mobile, password_hash,
         two_factor_enabled, two_factor_method
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        organizationId, roleRow.rows[0].id, owner.fullName.trim(),
        owner.workEmail.trim().toLowerCase(), owner.mobile.trim(), hash,
        !!owner.twoFactorEnabled, owner.twoFactorEnabled ? owner.twoFactorMethod : null,
      ]
    );
    const userId = user.rows[0].id;

    await client.query(
      `INSERT INTO subscriptions (organization_id, plan, status) VALUES ($1, $2, 'active')`,
      [organizationId, subscription.plan]
    );

    await client.query('COMMIT');

    const token = sign({ userId, organizationId, role: 'owner' });
    res.status(201).json({ token, organizationId, userId });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Company or email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Company registration failed' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------
// GET /company/:id — tenant profile (protected + tenant-isolated: a user
// can only ever read/write their own organization, regardless of :id).
// ---------------------------------------------------------------------
router.get('/company/:id', authenticate, async (req, res) => {
  if (req.params.id !== req.user.organizationId) return res.status(403).json({ error: 'Forbidden' });
  const { rows } = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// PUT /company/:id — edit tenant profile (Step 7 "edit previous steps", or
// settings later on). Only a known, safe column allow-list is writable.
const EDITABLE_COLUMNS = [
  'name', 'legal_name', 'business_type', 'industry', 'website', 'logo_url',
  'employee_count', 'description', 'company_email', 'company_phone',
  'support_email', 'alternate_phone', 'address_line1', 'address_line2',
  'city', 'state', 'country', 'postal_code', 'gst_number', 'pan_number',
  'registration_number', 'incorporation_cert_url', 'gst_cert_url',
  'registration_cert_url', 'subscription_plan', 'coupon_code',
];
const CAMEL_TO_SNAKE = (s) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

router.put('/company/:id', authenticate, async (req, res) => {
  if (req.params.id !== req.user.organizationId) return res.status(403).json({ error: 'Forbidden' });

  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(req.body || {})) {
    const column = CAMEL_TO_SNAKE(key);
    if (!EDITABLE_COLUMNS.includes(column)) continue; // silently ignore unknown/unsafe fields
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'No editable fields provided' });

  values.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE organizations SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A company with this name already exists' });
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ---------------------------------------------------------------------
// POST /company/upload — logo (Step 2) and verification documents (Step 5).
// Same disk-storage convention as automation-service/mediaController.js.
// Public (no `authenticate`) because logo/documents are uploaded mid-wizard,
// before the tenant/owner account exists yet and a JWT can be issued.
// ---------------------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'company');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME.has(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Only PNG, JPG and PDF are allowed.`));
    }
    cb(null, true);
  },
});

// field name "file"; optional "kind" field (logo | incorporation | gst | registration) for logging/labeling only
router.post('/company/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds the 10 MB limit.' });
    }
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received (expected form field "file").' });

    const publicBase = process.env.AUTH_PUBLIC_URL || `http://localhost:${process.env.AUTH_PORT || 4001}`;
    const url = `${publicBase}/uploads/company/${req.file.filename}`;

    res.status(201).json({
      url,
      filename: req.file.originalname,
      sizeBytes: req.file.size,
      mimeType: req.file.mimetype,
      kind: req.body.kind || null,
    });
  });
});

module.exports = router;
