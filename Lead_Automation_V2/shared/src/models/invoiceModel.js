// shared/src/models/invoiceModel.js
//
// Module 2 (part 2) — GST Invoice Generator. See
// infra/db/migrations/027_subscription_billing.sql for the schema and
// for why buyer/seller GST fields are snapshotted onto the invoice row
// instead of joined out to `organizations` at read time.
//
// GST MECHANICS (for reviewers unfamiliar with Indian GST — this is the
// one place in the codebase that needs to get this right):
//   - Every GSTIN's first 2 digits are the state code it was registered
//     in (e.g. "27" = Maharashtra, "07" = Delhi).
//   - If the seller's and buyer's state codes MATCH, the transaction is
//     "intra-state": tax splits evenly into CGST + SGST (half the total
//     rate each, both go to the same total).
//   - If they DIFFER, it's "inter-state": the full rate is charged as a
//     single IGST line instead.
//   - "Place of supply" is the buyer's state — required on every GST
//     invoice regardless of split.
// A buyer with no GSTIN (composition-scheme or unregistered tenants) is
// treated as inter-state-by-default-rate B2C: still taxed, still needs a
// place of supply, just no buyer GSTIN line on the invoice.

const { pool } = require('../db');

// The platform's own GST registration. Real values belong in env vars —
// these are placeholders so the invoice generator has something to run
// against out of the box; a wrong seller GSTIN silently produces wrong
// CGST/SGST-vs-IGST invoices, so this is deliberately loud rather than a
// silent fallback deep in the tax math.
const PLATFORM_GST_PROFILE = {
  legalName: process.env.PLATFORM_LEGAL_NAME || 'Orba Technologies Pvt Ltd',
  gstin: process.env.PLATFORM_GSTIN || null,
  stateCode: process.env.PLATFORM_GST_STATE_CODE || null, // e.g. '27'
};

const DEFAULT_GST_RATE = Number(process.env.SAAS_GST_RATE_PCT || 18); // India standard rate for SaaS/IT services
const DEFAULT_HSN_SAC = '998314'; // "Information technology (IT) support services"

// GSTIN format: 2-digit state code + 10-char PAN + 1 entity code + 1 checksum + 'Z'.
function stateCodeFromGstin(gstin) {
  if (!gstin || gstin.length < 2) return null;
  return gstin.slice(0, 2);
}

function isConfigured() {
  return Boolean(PLATFORM_GST_PROFILE.gstin && PLATFORM_GST_PROFILE.stateCode);
}

// Indian financial year: Apr 1 – Mar 31. Aug 2026 -> "2026-27".
function currentFinancialYear(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed; Apr = 3
  const startYear = m >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

// Atomic, gapless-per-FY sequence — a single UPSERT is enough (no
// explicit BEGIN/SELECT..FOR UPDATE needed): Postgres serializes
// concurrent ON CONFLICT DO UPDATE writers to the same row internally.
async function nextInvoiceNumber(financialYear = currentFinancialYear()) {
  const { rows } = await pool.query(
    `INSERT INTO invoice_counters (financial_year, last_number)
     VALUES ($1, 1)
     ON CONFLICT (financial_year) DO UPDATE SET last_number = invoice_counters.last_number + 1
     RETURNING last_number`,
    [financialYear]
  );
  const seq = rows[0].last_number;
  return `INV/${financialYear}/${String(seq).padStart(5, '0')}`;
}

// Computes the CGST/SGST/IGST split for a given subtotal + buyer state.
// Pure function (no DB) so it's independently testable.
function computeGst(subtotal, { buyerGstin, buyerStateCode, gstRate = DEFAULT_GST_RATE } = {}) {
  if (!isConfigured()) {
    throw new Error(
      'GST invoicing is not configured: set PLATFORM_GSTIN and PLATFORM_GST_STATE_CODE in the environment before generating invoices.'
    );
  }
  if (!(Number(subtotal) >= 0)) throw new Error('subtotal must be a non-negative number');

  const derivedBuyerStateCode = buyerStateCode || stateCodeFromGstin(buyerGstin);
  const intraState = derivedBuyerStateCode != null && derivedBuyerStateCode === PLATFORM_GST_PROFILE.stateCode;

  const round2 = (n) => Math.round(n * 100) / 100;

  if (intraState) {
    const halfRate = gstRate / 2;
    const cgstAmount = round2((subtotal * halfRate) / 100);
    const sgstAmount = round2((subtotal * halfRate) / 100);
    return {
      cgstRate: halfRate, cgstAmount,
      sgstRate: halfRate, sgstAmount,
      igstRate: 0, igstAmount: 0,
      totalTax: round2(cgstAmount + sgstAmount),
      intraState: true,
    };
  }

  const igstAmount = round2((subtotal * gstRate) / 100);
  return {
    cgstRate: 0, cgstAmount: 0,
    sgstRate: 0, sgstAmount: 0,
    igstRate: gstRate, igstAmount,
    totalTax: igstAmount,
    intraState: false,
  };
}

// Creates a draft invoice row (status='draft') for arbitrary line items
// against an organization — the general-purpose entry point. Callers
// with a subscription/payment context use the two convenience wrappers
// below, which just shape lineItems/subscriptionId/paymentId for you.
async function createDraft(organizationId, { lineItems, subscriptionId = null, paymentId = null, dueDate = null, adminId = null } = {}) {
  if (!Array.isArray(lineItems) || !lineItems.length) {
    throw new Error('lineItems must be a non-empty array of { description, amount }');
  }
  const subtotal = lineItems.reduce((sum, li) => sum + Number(li.amount), 0);
  if (!(subtotal >= 0)) throw new Error('Line items must sum to a non-negative amount');

  const orgRes = await pool.query(
    `SELECT name, legal_name, gst_number, state FROM organizations WHERE id = $1`,
    [organizationId]
  );
  if (!orgRes.rows.length) throw new Error(`Organization ${organizationId} not found`);
  const org = orgRes.rows[0];

  const gst = computeGst(subtotal, { buyerGstin: org.gst_number });
  const total = Math.round((subtotal + gst.totalTax) * 100) / 100;

  const { rows } = await pool.query(
    `INSERT INTO invoices (
       organization_id, subscription_id, payment_id,
       seller_gstin, seller_state_code,
       buyer_legal_name, buyer_gstin, buyer_state, buyer_state_code, place_of_supply,
       hsn_sac_code, line_items, subtotal,
       cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
       total_tax, amount, currency, status, due_date, generated_by_admin
     ) VALUES (
       $1,$2,$3, $4,$5, $6,$7,$8,$9,$10, $11,$12,$13,
       $14,$15,$16,$17,$18,$19, $20,$21,'INR','draft',$22,$23
     ) RETURNING *`,
    [
      organizationId, subscriptionId, paymentId,
      PLATFORM_GST_PROFILE.gstin, PLATFORM_GST_PROFILE.stateCode,
      org.legal_name || org.name, org.gst_number || null, org.state || null,
      stateCodeFromGstin(org.gst_number), org.state || 'Unknown',
      DEFAULT_HSN_SAC, JSON.stringify(lineItems), subtotal,
      gst.cgstRate, gst.cgstAmount, gst.sgstRate, gst.sgstAmount, gst.igstRate, gst.igstAmount,
      gst.totalTax, total, dueDate,
      adminId,
    ]
  );
  return rows[0];
}

// Stamps a draft invoice as issued (assigns its permanent invoice_number
// at this point, not at draft-creation — so a discarded draft never
// burns a real, gapless sequence number).
async function issue(invoiceId) {
  try {
    await pool.query('BEGIN');
    const check = await pool.query(`SELECT status FROM invoices WHERE id = $1 FOR UPDATE`, [invoiceId]);
    if (!check.rows.length) {
      await pool.query('ROLLBACK');
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    if (check.rows[0].status !== 'draft') {
      await pool.query('ROLLBACK');
      throw new Error(`Invoice ${invoiceId} is not in draft status (current: "${check.rows[0].status}")`);
    }
    // Only reached once we know this invoice will actually be issued —
    // see the note above on why the number must not be allocated any
    // earlier than this.
    const invoiceNumber = await nextInvoiceNumber();
    const { rows } = await pool.query(
      `UPDATE invoices
          SET invoice_number = $2, status = 'issued', issued_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [invoiceId, invoiceNumber]
    );
    await pool.query('COMMIT');
    return rows[0];
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

async function markPaid(invoiceId) {
  const { rows } = await pool.query(
    `UPDATE invoices SET status = 'paid', updated_at = now() WHERE id = $1 AND status = 'issued' RETURNING *`,
    [invoiceId]
  );
  return rows[0] || null;
}

async function void_(invoiceId) {
  const { rows } = await pool.query(
    `UPDATE invoices SET status = 'void', updated_at = now() WHERE id = $1 AND status != 'paid' RETURNING *`,
    [invoiceId]
  );
  if (!rows.length) throw new Error(`Invoice ${invoiceId} not found, or already paid (paid invoices cannot be voided — issue a credit note instead)`);
  return rows[0];
}

// Convenience wrapper: one invoice line for "Subscription — <plan> (<cycle>)".
async function generateForSubscription(organizationId, subscription, { adminId } = {}) {
  const label = `Subscription — ${subscription.plan} plan (${subscription.billing_cycle}), period ${subscription.current_period_start} to ${subscription.current_period_end}`;
  return createDraft(organizationId, {
    lineItems: [{ description: label, amount: Number(subscription.amount) }],
    subscriptionId: subscription.id,
    adminId,
  });
}

async function getById(invoiceId) {
  const { rows } = await pool.query(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]);
  return rows[0] || null;
}

async function listForOrg(organizationId, { page = 1, pageSize = 50, status } = {}) {
  const limit = Math.max(1, Math.min(pageSize, 200));
  const offset = (Math.max(1, page) - 1) * limit;
  const params = [organizationId];
  let where = 'organization_id = $1';
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM invoices WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

// Cross-tenant list for the platform GST-invoices view (Rankzy-style).
async function listAll({ page = 1, pageSize = 50, status, fromDate, toDate } = {}) {
  const limit = Math.max(1, Math.min(pageSize, 200));
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }
  if (fromDate) { params.push(fromDate); conditions.push(`i.created_at >= $${params.length}`); }
  if (toDate) { params.push(toDate); conditions.push(`i.created_at <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM invoices i ${where}`, params);
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT i.*, o.name AS organization_name
       FROM invoices i JOIN organizations o ON o.id = i.organization_id
       ${where}
      ORDER BY i.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows, total: countRes.rows[0].total, page, pageSize: limit };
}

async function platformSummary() {
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total_amount, COALESCE(SUM(total_tax), 0) AS total_tax
       FROM invoices
      GROUP BY status`
  );
  return rows;
}

module.exports = {
  PLATFORM_GST_PROFILE,
  DEFAULT_GST_RATE,
  isConfigured,
  stateCodeFromGstin,
  currentFinancialYear,
  nextInvoiceNumber,
  computeGst,
  createDraft,
  issue,
  markPaid,
  void: void_,
  generateForSubscription,
  getById,
  listForOrg,
  listAll,
  platformSummary,
};
