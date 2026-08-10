// services/finance-service/src/routes/transactions.js
//
// Unified INCOME/EXPENSE ledger (finance_transactions). Course-enrollment
// INCOME rows are normally created via routes/invoices.js (which also
// writes the statutory course_invoices row) — POST here directly is mainly
// for EXPENSE entries (Expenses & Outgoings tab) and for INCOME that isn't
// a GST-invoiced course sale (e.g. a manually logged misc receipt).

const express = require('express');
const { pool, requireRole } = require('@lead/shared');

const router = express.Router();

const EXPENSE_CATEGORIES = ['SALARY', 'UTILITIES', 'TAXES', 'VENDOR', 'SOFTWARE', 'RENT', 'OTHER'];
const INCOME_CATEGORIES = ['COURSE_ENROLLMENT', 'OTHER'];

// GET /finances/transactions?type=EXPENSE&from=2026-01-01&to=2026-12-31&page=1
router.get('/', async (req, res) => {
  const { type, from, to, category } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, parseInt(req.query.pageSize, 10) || 50);
  const offset = (page - 1) * pageSize;

  const conditions = ['organization_id = $1'];
  const params = [req.user.organizationId];
  if (type) { params.push(type); conditions.push(`type = $${params.length}`); }
  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`transaction_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`transaction_date <= $${params.length}`); }
  const where = conditions.join(' AND ');

  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM finance_transactions WHERE ${where}`, params);
  params.push(pageSize, offset);
  const { rows } = await pool.query(
    `SELECT * FROM finance_transactions WHERE ${where}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ rows, total: countRes.rows[0].total, page, pageSize });
});

// POST /finances/transactions — log an expense (or a non-invoiced income row).
// Also the target of the Sales Agent's `recordExpense` tool (see
// ai-agent-backend/app/services/service_client.py: record_expense()).
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const {
    type, category, amount, currency = 'INR', paymentMethod, referenceId,
    description, tdsNotes, transactionDate, source = 'manual',
  } = req.body;

  if (!['INCOME', 'EXPENSE'].includes(type)) {
    return res.status(400).json({ error: "type must be 'INCOME' or 'EXPENSE'" });
  }
  const validCategories = type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${validCategories.join(', ')}` });
  }
  if (!(Number(amount) > 0)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const { rows } = await pool.query(
    `INSERT INTO finance_transactions (
       organization_id, type, category, amount, currency, payment_method,
       reference_id, description, tds_notes, transaction_date, source, created_by_user
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10, CURRENT_DATE),$11,$12)
     RETURNING *`,
    [
      req.user.organizationId, type, category, amount, currency, paymentMethod || null,
      referenceId || null, description || null, tdsNotes || null, transactionDate || null,
      source, req.user.userId || null,
    ]
  );
  res.status(201).json(rows[0]);
});

// DELETE /finances/transactions/:id — remove a manually-entered row.
// Invoice-linked INCOME rows can't be deleted this way — void the invoice
// via routes/invoices.js instead, which keeps the two in sync.
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM finance_transactions
      WHERE id = $1 AND organization_id = $2 AND invoice_id IS NULL
      RETURNING id`,
    [req.params.id, req.user.organizationId]
  );
  if (!rows.length) {
    return res.status(404).json({ error: 'Transaction not found, or it is linked to an invoice (void the invoice instead)' });
  }
  res.status(204).end();
});

module.exports = router;
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
module.exports.INCOME_CATEGORIES = INCOME_CATEGORIES;
