// services/auth-service/src/controllers/superAdminController.js
//
// Platform Super Admin API — tenant governance, wallet billing, agent
// performance, feature flags. Mounted in index.js the same way
// companyController.js is (`app.use(superAdminController)`).
//
// Every route except /super-admin/login sits behind requireSuperAdmin
// (shared/src/superAdmin.js), which verifies a platform-admin JWT and
// pins the request to withSystemAccess() — these handlers deliberately
// query across every tenant, unlike the rest of this service.

const express = require('express');
const bcrypt = require('bcryptjs');
const {
  pool,
  withSystemAccess,
  requireSuperAdmin,
  signSuperAdminToken,
  logSuperAdminAction,
  companyModel,
  userModel,
  leadModel,
  walletModel,
} = require('@lead/shared');

const router = express.Router();

// ---------- Auth ----------
// Deliberately separate from /auth/login: that endpoint looks up
// `users` (tenant-scoped) and signs a token carrying organizationId.
// Platform admins live in `platform_admins` (no organization), so this
// needs its own lookup and its own token shape (see superAdmin.js).
router.post('/super-admin/login', async (req, res) => {
  const { password } = req.body;
  const email = req.body.email?.trim().toLowerCase();
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });

  // platform_admins is bypass_only under RLS (see its policy in rls.sql) —
  // a plain pool.query() here would silently get zero rows on a
  // real ('active') admin, not an error, so this is easy to miss without
  // testing against a real app_user connection instead of a superuser one.
  const { rows } = await withSystemAccess(() =>
    pool.query(
      `SELECT id, email, password_hash, status FROM platform_admins WHERE email = $1 LIMIT 1`,
      [email]
    )
  );
  if (!rows.length || rows[0].status !== 'active') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signSuperAdminToken({ adminId: rows[0].id, email: rows[0].email });
  res.json({ token });
});

// Everything below requires a valid platform-admin token. Safe to apply
// as a blanket prefix match even though it also matches /super-admin/login:
// the login handler above always terminates the request (res.json) and
// never calls next(), so it's never reached for that specific request —
// Express just never gets here on the way to /login.
router.use('/super-admin', requireSuperAdmin);

// ---------- Dashboard (section: SuperAdminDashboard.jsx) ----------
router.get('/super-admin/dashboard', async (_req, res) => {
  const [financials, tenantCounts, lowBalance] = await Promise.all([
    walletModel.globalFinancials(),
    pool.query(
      `SELECT status, COUNT(*)::int AS count FROM organizations GROUP BY status`
    ),
    pool.query(
      `SELECT o.id, o.name, w.balance, w.low_balance_threshold
         FROM wallets w JOIN organizations o ON o.id = w.organization_id
        WHERE w.balance < w.low_balance_threshold
        ORDER BY w.balance ASC
        LIMIT 20`
    ),
  ]);

  res.json({
    financials, // total_revenue_collected, total_credits_spent, total_active_balance, low_balance_org_count
    tenantsByStatus: tenantCounts.rows,
    lowBalanceAlerts: lowBalance.rows,
  });
});

// ---------- Company (tenant) management ----------
router.get('/super-admin/companies', async (req, res) => {
  const { page, pageSize, status, subscriptionPlan, search } = req.query;
  const result = await companyModel.list({
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
    status,
    subscriptionPlan,
    search,
  });
  res.json(result);
});

// Combined detail view: company info + wallet + agent breakdown + pipeline —
// everything CompanyDetailView.jsx needs in one call, since it's a single
// drawer/page rather than several independently-loading widgets.
router.get('/super-admin/companies/:id', async (req, res) => {
  const org = await companyModel.findById(req.params.id);
  if (!org) return res.status(404).json({ error: 'Company not found' });

  const [wallet, roleBreakdown, agentMetrics, pipeline] = await Promise.all([
    walletModel.getWallet(req.params.id),
    userModel.roleBreakdownByOrg(req.params.id),
    leadModel.agentMetrics(req.params.id),
    leadModel.pipelineSummary(req.params.id),
  ]);

  res.json({ company: org, wallet, roleBreakdown, agentMetrics, pipeline });
});

router.patch('/super-admin/companies/:id/status', async (req, res) => {
  const { status } = req.body;
  const updated = await companyModel.updateStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Company not found' });
  await logSuperAdminAction(req, req.params.id, 'super_admin.company.status_update', { status });
  res.json(updated);
});

router.patch('/super-admin/companies/:id/plan', async (req, res) => {
  const { subscriptionPlan } = req.body;
  if (!subscriptionPlan) return res.status(400).json({ error: 'subscriptionPlan required' });
  const updated = await companyModel.updateSubscriptionPlan(req.params.id, subscriptionPlan);
  if (!updated) return res.status(404).json({ error: 'Company not found' });
  await logSuperAdminAction(req, req.params.id, 'super_admin.company.plan_update', { subscriptionPlan });
  res.json(updated);
});

router.get('/super-admin/companies/:id/agents', async (req, res) => {
  const [roleBreakdown, agentMetrics] = await Promise.all([
    userModel.roleBreakdownByOrg(req.params.id),
    leadModel.agentMetrics(req.params.id),
  ]);
  res.json({ roleBreakdown, agentMetrics });
});

// ---------- Wallet & billing ----------
router.get('/super-admin/companies/:id/wallet', async (req, res) => {
  const wallet = await walletModel.getWallet(req.params.id);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
  res.json(wallet);
});

// Manual top-up — "Automatic Low-Balance Warning" is just the
// balance < low_balance_threshold check surfaced on the dashboard and
// in this response (see deduct()'s lowBalance flag for the deduction
// side); there's no separate notification pipeline here yet.
router.post('/super-admin/companies/:id/wallet/recharge', async (req, res) => {
  const { amount, referenceId, description } = req.body;
  if (!(Number(amount) > 0)) return res.status(400).json({ error: 'amount must be a positive number' });
  try {
    const result = await walletModel.recharge(req.params.id, Number(amount), {
      referenceId,
      description,
      adminId: req.admin.adminId,
    });
    await logSuperAdminAction(req, req.params.id, 'super_admin.wallet.recharge', { amount, referenceId });
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/super-admin/companies/:id/wallet/ledger', async (req, res) => {
  const { page, pageSize } = req.query;
  const rows = await walletModel.ledger(req.params.id, {
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });
  res.json(rows);
});

// ---------- Feature flags ----------
router.get('/super-admin/companies/:id/feature-flags', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT flag_key, enabled, updated_at FROM feature_flags WHERE organization_id = $1 ORDER BY flag_key`,
    [req.params.id]
  );
  res.json(rows);
});

router.put('/super-admin/companies/:id/feature-flags/:flagKey', async (req, res) => {
  const { enabled } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO feature_flags (organization_id, flag_key, enabled, updated_by_admin, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (organization_id, flag_key)
     DO UPDATE SET enabled = EXCLUDED.enabled, updated_by_admin = EXCLUDED.updated_by_admin, updated_at = now()
     RETURNING flag_key, enabled, updated_at`,
    [req.params.id, req.params.flagKey, !!enabled, req.admin.adminId]
  );
  await logSuperAdminAction(req, req.params.id, 'super_admin.feature_flag.update', {
    flagKey: req.params.flagKey,
    enabled: !!enabled,
  });
  res.json(rows[0]);
});

// ---------- Audit log (platform-wide) ----------
// team-service's GET /audit-logs is tenant-scoped (req.user.organizationId);
// this is the cross-tenant equivalent for Super Admin oversight, with an
// optional organizationId filter for "show me this one tenant's history".
router.get('/super-admin/audit-logs', async (req, res) => {
  const { organizationId, action, limit = 100, offset = 0 } = req.query;
  const { rows } = await pool.query(
    `SELECT a.id, a.organization_id, o.name AS organization_name, a.user_id,
            u.name AS user_name, a.action, a.meta, a.created_at
       FROM audit_logs a
       LEFT JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN users u ON u.id = a.user_id
      WHERE ($1::uuid IS NULL OR a.organization_id = $1)
        AND ($2::text IS NULL OR a.action ILIKE '%' || $2 || '%')
      ORDER BY a.created_at DESC
      LIMIT $3 OFFSET $4`,
    [organizationId || null, action || null, Number(limit), Number(offset)]
  );
  res.json(rows);
});

module.exports = router;
