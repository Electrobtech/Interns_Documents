const express = require('express');
const cors = require('cors');
const { authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ service: 'finance', ok: true }));

// Tenant-scoped, JSON API — same authenticate middleware as every other
// service (see shared/src/auth.js), which also pins the request onto a
// withTenantScope() connection so Postgres RLS enforces org isolation on
// finance_transactions/course_invoices even if a query is missing a WHERE.
app.use(authenticate);

app.use('/finances/transactions', require('./routes/transactions'));
app.use('/finances/invoices', require('./routes/invoices'));
app.use('/finances/summary', require('./routes/summary'));

app.use((err, _req, res, _next) => {
  console.error('[finance] unhandled error', err);
  if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal finance error' });
});

const PORT = process.env.PORT || 4016;
app.listen(PORT, () => console.log(`finance-service on :${PORT}`));
