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
  requirePlatformRole,
  signSuperAdminToken,
  logSuperAdminAction,
  companyModel,
  userModel,
  leadModel,
  walletModel,
  channelQuotaModel,
  platformAnalyticsModel,
  platformAdminModel,
  platformGovernanceModel,
  platformHealthModel,
  subscriptionModel,
  invoiceModel,
  paymentModel,
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

// Lets the frontend know who's logged in and what they're allowed to do
// (role gating itself is enforced server-side via requirePlatformRole on
// every mutating route below — this is only so the UI can hide controls
// a given role can't use, not the actual security boundary).
router.get('/super-admin/me', (req, res) => res.json(req.admin));

// ---------- Dashboard (section: SuperAdminDashboard.jsx) ----------
router.get('/super-admin/dashboard', async (_req, res) => {
  // Sequential, not Promise.all: inside withSystemAccess(), pool.query
  // routes through one pg Client pinned to this request (see db.js) —
  // reproduced against real Postgres that concurrent queries on it trigger
  // pg's "client already executing a query" deprecation warning (removed
  // entirely in pg@9). See platformAnalyticsModel.js's automationMetrics()
  // for the same fix with more detail.
  const financials = await walletModel.globalFinancials();
  const tenantCounts = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM organizations GROUP BY status`
  );
  const lowBalance = await pool.query(
    `SELECT o.id, o.name, w.balance, w.low_balance_threshold
       FROM wallets w JOIN organizations o ON o.id = w.organization_id
      WHERE w.balance < w.low_balance_threshold
      ORDER BY w.balance ASC
      LIMIT 20`
  );

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

  // Sequential — see the dashboard route above for why Promise.all across
  // pool.query calls isn't safe inside withSystemAccess().
  const wallet = await walletModel.getWallet(req.params.id);
  const roleBreakdown = await userModel.roleBreakdownByOrg(req.params.id);
  const agentMetrics = await leadModel.agentMetrics(req.params.id);
  const pipeline = await leadModel.pipelineSummary(req.params.id);
  const subscription = await subscriptionModel.getByOrg(req.params.id);

  res.json({ company: org, wallet, roleBreakdown, agentMetrics, pipeline, subscription });
});

router.patch('/super-admin/companies/:id/status', requirePlatformRole('super_admin'), async (req, res) => {
  const { status } = req.body;
  const updated = await companyModel.updateStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Company not found' });
  await logSuperAdminAction(req, req.params.id, 'super_admin.company.status_update', { status });
  res.json(updated);
});

router.patch('/super-admin/companies/:id/plan', requirePlatformRole('super_admin'), async (req, res) => {
  const { subscriptionPlan } = req.body;
  if (!subscriptionPlan) return res.status(400).json({ error: 'subscriptionPlan required' });
  const updated = await companyModel.updateSubscriptionPlan(req.params.id, subscriptionPlan);
  if (!updated) return res.status(404).json({ error: 'Company not found' });
  // Keep subscriptions.plan in sync — see subscriptionModel.js header note.
  // Best-effort: a company can in principle exist without a subscriptions
  // row (pre-Module-2 test data); don't fail the whole request over that.
  try {
    await subscriptionModel.updatePlan(req.params.id, { plan: subscriptionPlan, adminId: req.admin.adminId });
  } catch (e) {
    console.warn('[super-admin.plan_update] subscriptions row out of sync:', e.message);
  }
  await logSuperAdminAction(req, req.params.id, 'super_admin.company.plan_update', { subscriptionPlan });
  res.json(updated);
});

router.get('/super-admin/companies/:id/agents', async (req, res) => {
  const roleBreakdown = await userModel.roleBreakdownByOrg(req.params.id);
  const agentMetrics = await leadModel.agentMetrics(req.params.id);
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
router.post('/super-admin/companies/:id/wallet/recharge', requirePlatformRole('super_admin', 'billing_admin'), async (req, res) => {
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

router.put('/super-admin/companies/:id/feature-flags/:flagKey', requirePlatformRole('super_admin'), async (req, res) => {
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

// ---------- Channel quotas (Module 1: Tenant & Channel Quota Management) ----------
// One row per (organization, channel type) — see channelQuotaModel.js and
// infra/db/migrations/026_channel_quotas.sql for why this is separate
// from the tenant-facing `channels` connections table.
router.get('/super-admin/companies/:id/channels', async (req, res) => {
  try {
    const rows = await channelQuotaModel.listForOrg(req.params.id);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/super-admin/companies/:id/channels/:channel', requirePlatformRole('super_admin'), async (req, res) => {
  const { enabled, monthlyQuota, lowQuotaThresholdPct, disabledReason } = req.body;
  try {
    const updated = await channelQuotaModel.upsertConfig(req.params.id, req.params.channel, {
      enabled,
      monthlyQuota,
      lowQuotaThresholdPct,
      disabledReason,
      adminId: req.admin.adminId,
    });
    await logSuperAdminAction(req, req.params.id, 'super_admin.channel_quota.update', {
      channel: req.params.channel,
      enabled,
      monthlyQuota,
      lowQuotaThresholdPct,
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/super-admin/companies/:id/channels/:channel/reset', async (req, res) => {
  try {
    const updated = await channelQuotaModel.resetUsage(req.params.id, req.params.channel, {
      adminId: req.admin.adminId,
    });
    await logSuperAdminAction(req, req.params.id, 'super_admin.channel_quota.reset_usage', {
      channel: req.params.channel,
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Cross-tenant rollup (feeds Module 3's channel-distribution widget).
router.get('/super-admin/channels/summary', async (_req, res) => {
  const rows = await channelQuotaModel.platformSummary();
  res.json(rows);
});

// ---------- Subscriptions, Invoicing & GST Billing (Module 2) ----------
router.get('/super-admin/companies/:id/subscription', async (req, res) => {
  const sub = await subscriptionModel.getByOrg(req.params.id);
  if (!sub) return res.status(404).json({ error: 'No subscription found for this company' });
  res.json(sub);
});

router.put('/super-admin/companies/:id/subscription', requirePlatformRole('super_admin', 'billing_admin'), async (req, res) => {
  const { plan, billingCycle, amount, autoBilling } = req.body;
  try {
    const updated = await subscriptionModel.updatePlan(req.params.id, {
      plan, billingCycle, amount, autoBilling, adminId: req.admin.adminId,
    });
    await logSuperAdminAction(req, req.params.id, 'super_admin.subscription.update', {
      plan, billingCycle, amount, autoBilling,
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/super-admin/companies/:id/subscription/status', requirePlatformRole('super_admin', 'billing_admin'), async (req, res) => {
  const { status } = req.body;
  try {
    const updated = await subscriptionModel.updateStatus(req.params.id, status, { adminId: req.admin.adminId });
    await logSuperAdminAction(req, req.params.id, 'super_admin.subscription.status_update', { status });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Renews the billing period AND generates the GST invoice for it in one
// step — this is deliberately the only way Super Admin renews a
// subscription, so a renewed period can never exist without a matching
// invoice (or vice versa). See invoiceModel.generateForSubscription.
//
// Wrapped in an explicit transaction at this level (rather than inside
// subscriptionModel.renew()/invoiceModel.createDraft() individually,
// which are each a single atomic statement on their own) because it's
// the *pair* of calls that needs to be all-or-nothing: reproduced this
// against a real Postgres instance with PLATFORM_GSTIN unset — without
// this BEGIN/COMMIT, renew() committed the new period immediately and
// generateForSubscription()'s "GST invoicing is not configured" error
// left the subscription renewed with zero matching invoices, silently
// contradicting the guarantee described above.
router.post('/super-admin/companies/:id/subscription/renew', requirePlatformRole('super_admin', 'billing_admin'), async (req, res) => {
  try {
    await pool.query('BEGIN');
    const renewed = await subscriptionModel.renew(req.params.id, { adminId: req.admin.adminId });
    const invoice = await invoiceModel.generateForSubscription(req.params.id, renewed, { adminId: req.admin.adminId });
    await pool.query('COMMIT');
    await logSuperAdminAction(req, req.params.id, 'super_admin.subscription.renew', {
      newPeriodEnd: renewed.current_period_end,
      invoiceId: invoice.id,
    });
    res.status(201).json({ subscription: renewed, invoice });
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: e.message });
  }
});

// ---------- GST Invoices ----------
router.get('/super-admin/companies/:id/invoices', async (req, res) => {
  const { page, pageSize, status } = req.query;
  const rows = await invoiceModel.listForOrg(req.params.id, {
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
    status,
  });
  res.json(rows);
});

router.get('/super-admin/invoices', async (req, res) => {
  const { page, pageSize, status, fromDate, toDate } = req.query;
  const result = await invoiceModel.listAll({
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
    status, fromDate, toDate,
  });
  res.json(result);
});

router.get('/super-admin/invoices/:invoiceId', async (req, res) => {
  const invoice = await invoiceModel.getById(req.params.invoiceId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
});

router.post('/super-admin/invoices/:invoiceId/issue', requirePlatformRole('super_admin', 'billing_admin'), async (req, res) => {
  try {
    const issued = await invoiceModel.issue(req.params.invoiceId);
    await logSuperAdminAction(req, issued.organization_id, 'super_admin.invoice.issue', {
      invoiceId: issued.id, invoiceNumber: issued.invoice_number,
    });
    res.json(issued);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/super-admin/invoices/:invoiceId/void', requirePlatformRole('super_admin', 'billing_admin'), async (req, res) => {
  try {
    const voided = await invoiceModel.void(req.params.invoiceId);
    await logSuperAdminAction(req, voided.organization_id, 'super_admin.invoice.void', { invoiceId: voided.id });
    res.json(voided);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/super-admin/billing/summary', async (_req, res) => {
  const subscriptions = await subscriptionModel.platformSummary();
  const invoices = await invoiceModel.platformSummary();
  res.json({ subscriptions, invoices });
});

// ---------- Payments & refunds (cross-tenant view over the existing payments ledger) ----------
// paymentModel.list() is tenant-scoped (billing-service's own routes);
// Super Admin needs the cross-tenant view, so this queries `payments`
// directly the same way audit-logs below does, rather than adding a
// second, near-duplicate model function.
router.get('/super-admin/payments', async (req, res) => {
  const { page = 1, pageSize = 50, status, purpose } = req.query;
  const limit = Math.max(1, Math.min(Number(pageSize) || 50, 200));
  const offset = (Math.max(1, Number(page)) - 1) * limit;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
  if (purpose) { params.push(purpose); conditions.push(`p.purpose = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM payments p ${where}`, params);
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT p.*, o.name AS organization_name
       FROM payments p JOIN organizations o ON o.id = p.organization_id
       ${where}
      ORDER BY p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ rows, total: countRes.rows[0].total, page: Number(page), pageSize: limit });
});

router.post('/super-admin/payments/:paymentId/refund', requirePlatformRole('super_admin', 'billing_admin'), async (req, res) => {
  const { reason } = req.body;
  const payment = await paymentModel.getById(req.params.paymentId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'paid') {
    return res.status(400).json({ error: `Only paid payments can be refunded (this one is "${payment.status}")` });
  }
  const refunded = await paymentModel.markRefunded(req.params.paymentId, { reason, adminId: req.admin.adminId });
  await logSuperAdminAction(req, payment.organization_id, 'super_admin.payment.refund', {
    paymentId: payment.id, amount: payment.amount, reason,
  });
  res.json(refunded);
});

// ---------- Analytics (Module 3: Aggregated Analytics Dashboard) ----------
// range: 'today' | '7d' | '30d' | 'this_month' | 'custom' (+ from/to for custom).
// See shared/src/models/platformAnalyticsModel.js for range semantics and,
// importantly, for what "message delivery rate" deliberately does NOT
// claim (the schema has no per-message delivery-status column).
router.get('/super-admin/analytics/overview', async (req, res) => {
  try {
    const bounds = platformAnalyticsModel.resolveRange(req.query);
    const overview = await platformAnalyticsModel.overview(bounds);
    res.json({ range: bounds.label, start: bounds.start, end: bounds.end, ...overview });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/super-admin/analytics/channels', async (req, res) => {
  try {
    const bounds = platformAnalyticsModel.resolveRange(req.query);
    const channels = await platformAnalyticsModel.channelDistribution(bounds);
    res.json({ range: bounds.label, channels });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/super-admin/analytics/automation', async (req, res) => {
  try {
    const bounds = platformAnalyticsModel.resolveRange(req.query);
    const automation = await platformAnalyticsModel.automationMetrics(bounds);
    res.json({ range: bounds.label, ...automation });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


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

// ---------- Governance & System Health (Module 4) ----------
// Role matrix enforced throughout this file via requirePlatformRole():
//   super_admin   — everything below, incl. managing other platform_admins
//   billing_admin — the wallet/subscription/invoice/payment routes above
//   support_lead  — read-only everywhere, plus channel-quota "reset usage"
// See platform_admins.role's column comment in
// infra/db/migrations/028_platform_governance.sql for the full rationale.

// Admin team (RBAC) — super_admin only, both to view and to manage.
router.get('/super-admin/admins', requirePlatformRole('super_admin'), async (_req, res) => {
  res.json(await platformAdminModel.list());
});

router.post('/super-admin/admins', requirePlatformRole('super_admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const created = await platformAdminModel.create({ name, email, password, role });
    await logSuperAdminAction(req, null, 'super_admin.admin.create', { newAdminId: created.id, role: created.role });
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/super-admin/admins/:id/role', requirePlatformRole('super_admin'), async (req, res) => {
  try {
    const updated = await platformAdminModel.updateRole(req.params.id, req.body.role);
    await logSuperAdminAction(req, null, 'super_admin.admin.role_update', { targetAdminId: req.params.id, role: req.body.role });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/super-admin/admins/:id/status', requirePlatformRole('super_admin'), async (req, res) => {
  try {
    const updated = await platformAdminModel.updateStatus(req.params.id, req.body.status);
    await logSuperAdminAction(req, null, 'super_admin.admin.status_update', { targetAdminId: req.params.id, status: req.body.status });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Announcement banners — readable (list) by any admin role; only
// super_admin creates/edits/deletes. Tenants read these through their own
// tenant-scoped route (see team-service or auth-service's tenant routes),
// not this one — this is the admin management side.
router.get('/super-admin/announcements', async (_req, res) => {
  res.json(await platformGovernanceModel.listAnnouncements());
});

router.post('/super-admin/announcements', requirePlatformRole('super_admin'), async (req, res) => {
  const { title, message, severity, startsAt, endsAt } = req.body;
  try {
    const created = await platformGovernanceModel.createAnnouncement({
      title, message, severity, startsAt, endsAt, adminId: req.admin.adminId,
    });
    await logSuperAdminAction(req, null, 'super_admin.announcement.create', { announcementId: created.id, severity: created.severity });
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/super-admin/announcements/:id', requirePlatformRole('super_admin'), async (req, res) => {
  const { title, message, severity, active, startsAt, endsAt } = req.body;
  try {
    const updated = await platformGovernanceModel.updateAnnouncement(req.params.id, { title, message, severity, active, startsAt, endsAt });
    await logSuperAdminAction(req, null, 'super_admin.announcement.update', { announcementId: req.params.id, active });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/super-admin/announcements/:id', requirePlatformRole('super_admin'), async (req, res) => {
  try {
    await platformGovernanceModel.deleteAnnouncement(req.params.id);
    await logSuperAdminAction(req, null, 'super_admin.announcement.delete', { announcementId: req.params.id });
    res.status(204).end();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// External provider status board — see platformGovernanceModel.js's
// header comment for why this is admin-set rather than a live poller.
router.get('/super-admin/system-health/providers', async (_req, res) => {
  res.json(await platformGovernanceModel.listServiceStatus());
});

router.patch('/super-admin/system-health/providers/:serviceKey', requirePlatformRole('super_admin'), async (req, res) => {
  const { status, note } = req.body;
  try {
    const updated = await platformGovernanceModel.updateServiceStatus(req.params.serviceKey, {
      status, note, adminId: req.admin.adminId,
    });
    await logSuperAdminAction(req, null, 'super_admin.provider_status.update', { serviceKey: req.params.serviceKey, status });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Internal microservice health — live pings, see platformHealthModel.js.
router.get('/super-admin/system-health/internal', async (_req, res) => {
  res.json(await platformHealthModel.checkAll());
});

module.exports = router;
