// services/finance-service/src/routes/invoices.js
//
// Course/service GST invoices (SAC 9992). POST / does the full flow in one
// transaction: computes the CGST/SGST-vs-IGST split, assigns the next
// gapless invoice number for this org+FY, writes the course_invoices row,
// AND writes the matching finance_transactions INCOME row — so the
// Overview and Invoices & Revenue tabs never fall out of sync with each
// other. This is also what the Sales Agent's `generateCourseInvoice` tool
// calls (see ai-agent-backend/app/services/service_client.py).

const express = require('express');
const { pool, requireRole } = require('@lead/shared');
const { splitInclusivePrice, nextInvoiceNumber, currentFinancialYear, stateCodeFromGstin, SAC_EDUCATION_SERVICES } = require('../lib/gst');
const { streamInvoicePdf } = require('../lib/pdf');

const router = express.Router();

// Looks up the org's own GST profile (seller side of every course
// invoice) — set via the Company Registration wizard (see
// infra/db/migrations/005_company_registration.sql / 012_gst_verification.sql).
async function getSellerProfile(organizationId) {
  const { rows } = await pool.query(
    `SELECT legal_name, name, gst_number, state, address_line1, address_line2, city, postal_code
       FROM organizations WHERE id = $1`,
    [organizationId]
  );
  if (!rows.length) throw new Error('Organization not found');
  const org = rows[0];
  const addressParts = [org.address_line1, org.address_line2, org.city, org.state, org.postal_code].filter(Boolean);
  return {
    legalName: org.legal_name || org.name,
    gstin: org.gst_number || null,
    stateCode: stateCodeFromGstin(org.gst_number),
    state: org.state || null,
    address: addressParts.join(', ') || null,
  };
}

async function generateCourseInvoiceInternal(organizationId, {
  studentName, studentGstin, studentAddress, studentState, studentStateCode,
  totalAmount, courseName, gstRate, source = 'manual', createdByUser = null,
}) {
  if (!studentName) throw new Error('studentName is required');
  if (!(Number(totalAmount) > 0)) throw new Error('totalAmount must be a positive number');

  const seller = await getSellerProfile(organizationId);
  if (!seller.gstin || !seller.stateCode) {
    throw new Error('This organization has no GST profile on file yet — complete GST details under Company Registration before generating invoices.');
  }

  const buyerStateCode = studentStateCode || stateCodeFromGstin(studentGstin);
  if (!buyerStateCode) {
    throw new Error("studentState/studentStateCode is required (or a valid studentGstin) to determine place of supply");
  }

  const gst = splitInclusivePrice(totalAmount, {
    sellerStateCode: seller.stateCode,
    buyerStateCode,
    gstRate,
  });

  const financialYear = currentFinancialYear();

  // IMPORTANT: uses pool.query('BEGIN'/'COMMIT'/'ROLLBACK') rather than a
  // raw pool.connect() client. shared/src/db.js's authenticate middleware
  // pins this request to ONE tenant-scoped connection via AsyncLocalStorage
  // and transparently routes pool.query() through it; pool.connect() would
  // instead hand out a *different*, unscoped connection, on which every
  // insert below would fail RLS's WITH CHECK (app_current_org() is NULL
  // outside a scope) — see billing-service/src/routes/invoices.js's
  // /generate handler for the same pattern.
  try {
    await pool.query('BEGIN');

    const invoiceNumber = await nextInvoiceNumber(organizationId, financialYear);

    const { rows: invRows } = await pool.query(
      `INSERT INTO course_invoices (
         organization_id, invoice_number, financial_year,
         seller_legal_name, seller_gstin, seller_address, seller_state, seller_state_code,
         student_name, student_gstin, student_address, student_state, student_state_code, place_of_supply,
         sac_code, course_name,
         base_amount, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
         intra_state, total_amount, status, pdf_generated_at, source, created_by_user
       ) VALUES (
         $1,$2,$3, $4,$5,$6,$7,$8, $9,$10,$11,$12,$13,$14, $15,$16,
         $17,$18,$19,$20,$21,$22,$23,$24, $25,$26,'issued',NULL,$27,$28
       ) RETURNING *`,
      [
        organizationId, invoiceNumber, financialYear,
        seller.legalName, seller.gstin, seller.address, seller.state, seller.stateCode,
        studentName, studentGstin || null, studentAddress || null, studentState || null, buyerStateCode, studentState || buyerStateCode,
        SAC_EDUCATION_SERVICES, courseName || null,
        gst.baseAmount, gstRate || 18, gst.cgstRate, gst.cgstAmount, gst.sgstRate, gst.sgstAmount, gst.igstRate, gst.igstAmount,
        gst.intraState, gst.totalAmount, source, createdByUser,
      ]
    );
    const invoice = invRows[0];

    const { rows: txnRows } = await pool.query(
      `INSERT INTO finance_transactions (
         organization_id, type, category, amount, currency, payment_method,
         reference_id, description, transaction_date, invoice_id, source, created_by_user
       ) VALUES ($1,'INCOME','COURSE_ENROLLMENT',$2,'INR',NULL,$3,$4,CURRENT_DATE,$5,$6,$7)
       RETURNING *`,
      [
        organizationId, invoice.total_amount, invoice.invoice_number,
        `Course enrollment — ${studentName}${courseName ? ` (${courseName})` : ''}`,
        invoice.id, source, createdByUser,
      ]
    );

    await pool.query('COMMIT');
    return { invoice, transaction: txnRows[0] };
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

// POST /finances/invoices — generate a course enrollment GST invoice.
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await generateCourseInvoiceInternal(req.user.organizationId, {
      ...req.body,
      createdByUser: req.user.userId || null,
    });
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /finances/invoices — list, most recent first.
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, parseInt(req.query.pageSize, 10) || 50);
  const offset = (page - 1) * pageSize;
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM course_invoices WHERE organization_id = $1`,
    [req.user.organizationId]
  );
  const { rows } = await pool.query(
    `SELECT * FROM course_invoices WHERE organization_id = $1
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [req.user.organizationId, pageSize, offset]
  );
  res.json({ rows, total: countRes.rows[0].total, page, pageSize });
});

// GET /finances/invoices/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM course_invoices WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
  res.json(rows[0]);
});

// GET /finances/invoices/:id/pdf — streams the Rule-46 GST invoice PDF.
router.get('/:id/pdf', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM course_invoices WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
  const invoice = rows[0];

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number.replace(/\//g, '-')}.pdf"`);
  streamInvoicePdf(invoice, res);

  pool.query(`UPDATE course_invoices SET pdf_generated_at = now() WHERE id = $1`, [invoice.id]).catch(() => {});
});

// POST /finances/invoices/:id/void — void a wrongly-issued invoice. Does
// NOT reuse the invoice number (a voided invoice's number stays burned —
// GST invoice numbers must never be reused, only credit-noted).
router.post('/:id/void', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('BEGIN');
    const { rows } = await pool.query(
      `UPDATE course_invoices SET status = 'void'
        WHERE id = $1 AND organization_id = $2 AND status = 'issued'
        RETURNING *`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found, or already void' });
    }
    await pool.query(
      `DELETE FROM finance_transactions WHERE invoice_id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    await pool.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.generateCourseInvoiceInternal = generateCourseInvoiceInternal;
