// services/finance-service/src/routes/summary.js
//
// Powers the Overview tab's summary cards + the Sales Agent's
// `getFinancialSummary` tool. `period` bounds default to the current
// calendar month so "this month" questions ("what's our net revenue this
// month?") work out of the box without extra params.

const express = require('express');
const { pool } = require('@lead/shared');

const router = express.Router();

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

// GET /finances/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { start, end } = defaultPeriod();
  const from = req.query.from || start;
  const to = req.query.to || end;

  const { rows } = await pool.query(
    `SELECT type, category, COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
       FROM finance_transactions
      WHERE organization_id = $1 AND transaction_date >= $2 AND transaction_date <= $3
      GROUP BY type, category`,
    [req.user.organizationId, from, to]
  );

  const totalRevenue = rows.filter((r) => r.type === 'INCOME').reduce((s, r) => s + Number(r.total), 0);
  const totalExpenses = rows.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + Number(r.total), 0);

  const byCategory = {};
  for (const r of rows) {
    byCategory[r.type] = byCategory[r.type] || {};
    byCategory[r.type][r.category] = { total: Number(r.total), count: r.count };
  }

  res.json({
    period: { from, to },
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round((totalRevenue - totalExpenses) * 100) / 100,
    byCategory,
    currency: 'INR',
  });
});

module.exports = router;
