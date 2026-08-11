// services/finance-service/src/lib/gst.js
//
// GST mechanics for course/service invoices (SAC 9992 — "Education
// services"), per CGST Rules 2017, Rule 46. Mirrors the split logic in
// shared/src/models/invoiceModel.js (that file: platform bills the tenant;
// this file: the tenant bills their own students) — kept as a separate,
// independently-testable module rather than importing that one, since the
// "seller" here is the *tenant org*, not the platform's fixed GST profile.
//
// GST MECHANICS RECAP:
//   - A GSTIN's first 2 digits are the state code it was registered in.
//   - Seller state code == buyer state code -> "intra-state": split the
//     rate evenly into CGST + SGST (half the rate each).
//   - Seller state code != buyer state code -> "inter-state": the full
//     rate is charged as a single IGST line.
//   - "Place of supply" is the buyer's (student's) state — required on
//     every GST invoice regardless of split.
//   - Students are usually unregistered (B2C) — no GSTIN, but a state is
//     still required to determine intra vs inter-state and place of supply.

const { pool } = require('@lead/shared');

const DEFAULT_GST_RATE = 18; // India standard rate for most services, incl. this repo's SAAS_GST_RATE_PCT convention
const SAC_EDUCATION_SERVICES = '9992';

// GSTIN format: 2-digit state code + 10-char PAN + 1 entity code + 1
// checksum + 'Z'.
function stateCodeFromGstin(gstin) {
  if (!gstin || gstin.length < 2) return null;
  return gstin.slice(0, 2);
}

// Indian financial year: Apr 1 - Mar 31. Aug 2026 -> "2026-27".
function currentFinancialYear(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed; Apr = 3
  const startYear = m >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Splits a GST-inclusive `totalPrice` into { baseAmount, ...gst breakdown }.
// This is what "extract base price from an 18% GST-inclusive total course
// price" means: baseAmount = totalPrice / (1 + rate/100).
function splitInclusivePrice(totalPrice, { sellerStateCode, buyerStateCode, gstRate = DEFAULT_GST_RATE } = {}) {
  if (!(Number(totalPrice) > 0)) throw new Error('totalPrice must be a positive number');
  if (!sellerStateCode) throw new Error('sellerStateCode is required (set the organization\'s GST profile under Company Registration first)');
  if (!buyerStateCode) throw new Error('buyerStateCode (student state) is required to determine place of supply');

  const baseAmount = round2(Number(totalPrice) / (1 + gstRate / 100));
  const gst = computeGstOnBase(baseAmount, { sellerStateCode, buyerStateCode, gstRate });
  // Reconcile rounding: total_amount must equal the original GST-inclusive
  // price exactly, so any paisa-level rounding drift lands on the base
  // amount rather than silently changing what the student was quoted.
  const reconciledBase = round2(Number(totalPrice) - gst.totalTax);
  return { baseAmount: reconciledBase, totalAmount: round2(totalPrice), ...gst };
}

// Computes the CGST/SGST/IGST split for an already-known base (exclusive)
// amount. Pure function (no DB) so it's independently testable.
function computeGstOnBase(baseAmount, { sellerStateCode, buyerStateCode, gstRate = DEFAULT_GST_RATE } = {}) {
  if (!(Number(baseAmount) >= 0)) throw new Error('baseAmount must be a non-negative number');
  const intraState = sellerStateCode === buyerStateCode;

  if (intraState) {
    const halfRate = gstRate / 2;
    const cgstAmount = round2((baseAmount * halfRate) / 100);
    const sgstAmount = round2((baseAmount * halfRate) / 100);
    return {
      cgstRate: halfRate, cgstAmount,
      sgstRate: halfRate, sgstAmount,
      igstRate: 0, igstAmount: 0,
      totalTax: round2(cgstAmount + sgstAmount),
      totalAmount: round2(baseAmount + cgstAmount + sgstAmount),
      intraState: true,
    };
  }

  const igstAmount = round2((baseAmount * gstRate) / 100);
  return {
    cgstRate: 0, cgstAmount: 0,
    sgstRate: 0, sgstAmount: 0,
    igstRate: gstRate, igstAmount,
    totalTax: igstAmount,
    totalAmount: round2(baseAmount + igstAmount),
    intraState: false,
  };
}

// Atomic, gapless-per-(org, FY) sequence: FY26-27/INV-0102. A single UPSERT
// is enough — Postgres serializes concurrent ON CONFLICT DO UPDATE writers
// to the same row internally (same pattern as invoiceModel.js's
// nextInvoiceNumber, keyed per-org here since every tenant runs its own
// series).
async function nextInvoiceNumber(organizationId, financialYear = currentFinancialYear()) {
  const { rows } = await pool.query(
    `INSERT INTO finance_invoice_counters (organization_id, financial_year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (organization_id, financial_year) DO UPDATE SET last_number = finance_invoice_counters.last_number + 1
     RETURNING last_number`,
    [organizationId, financialYear]
  );
  const seq = rows[0].last_number;
  return `FY${financialYear.replace('20', '')}/INV-${String(seq).padStart(4, '0')}`;
}

// ---------- Amount in words (Indian numbering: lakh/crore) ----------
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`.trim();
}
function threeDigits(n) {
  if (n < 100) return twoDigits(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + twoDigits(n % 100) : ''}`;
}

// Converts a non-negative rupee amount (paise ignored beyond rounding) to
// words in the Indian lakh/crore grouping, per CGST Rule 46's "amount in
// words" requirement. e.g. 123456.78 -> "One Lakh Twenty Three Thousand
// Four Hundred Fifty Six Rupees and Seventy Eight Paise Only"
function amountInWords(amount) {
  const rupees = Math.floor(Math.abs(Number(amount) || 0));
  const paise = Math.round((Math.abs(Number(amount) || 0) - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = (parts.join(' ') || 'Zero') + ' Rupees';
  if (paise > 0) words += ` and ${twoDigits(paise)} Paise`;
  return words + ' Only';
}

module.exports = {
  DEFAULT_GST_RATE,
  SAC_EDUCATION_SERVICES,
  stateCodeFromGstin,
  currentFinancialYear,
  splitInclusivePrice,
  computeGstOnBase,
  nextInvoiceNumber,
  amountInWords,
};
