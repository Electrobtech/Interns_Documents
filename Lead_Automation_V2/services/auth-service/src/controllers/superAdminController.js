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

// ---------- Channel-subscription billing (platform-admin side) ----------
// Manage the channel_plans catalogue (our own price per channel) and the
// Meta/SMS rate cards + per-org markup overrides. Tenant-facing reads of
// these same tables happen through billing-service's GET /billing/plans —
// this is the write side. See infra/db/migrations/025_channel_subscription_
// billing.sql for the full schema rationale.

router.get('/super-admin/channel-plans', async (_req, res) => {
  const { rows } = await pool.query(`SELECT * FROM channel_plans ORDER BY channel_type, billing_period`);
  res.json(rows);
});

// Superseding a price never UPDATEs in place — deactivates the current
// active row for that (channel_type, billing_period) and inserts a new
// one, so existing organization_channel_subscriptions rows (which
// snapshotted the old price) are unaffected, per the task brief's
// "later catalogue price changes don't retroactively change an existing
// client's rate" requirement.
router.put('/super-admin/channel-plans/:channelType', async (req, res) => {
  const { channelType } = req.params;
  const { ourFeeAmount, billingPeriod = 'monthly', currency = 'INR' } = req.body;
  if (!(Number(ourFeeAmount) >= 0)) {
    return res.status(400).json({ error: 'ourFeeAmount must be a non-negative number' });
  }

  try {
    await pool.query('BEGIN');
    await pool.query(
      `UPDATE channel_plans SET active = false, updated_at = now()
        WHERE channel_type = $1 AND billing_period = $2 AND active = true`,
      [channelType, billingPeriod]
    );
    const { rows } = await pool.query(
      `INSERT INTO channel_plans (channel_type, our_fee_amount, currency, billing_period, active)
       VALUES ($1,$2,$3,$4,true) RETURNING *`,
      [channelType, ourFeeAmount, currency, billingPeriod]
    );
    await pool.query('COMMIT');
    await logSuperAdminAction(req, null, 'super_admin.channel_plan.update', { channelType, billingPeriod, ourFeeAmount });
    res.json(rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
});

// GET/PUT Meta rate cards — the numbers to update whenever Meta revises
// its rate card (roughly every 6 months per category/country); never a
// constant in application code, see meta_rate_cards' own comments.
router.get('/super-admin/meta-rate-cards', async (_req, res) => {
  const { rows } = await pool.query(`SELECT * FROM meta_rate_cards ORDER BY channel_type, category, country_code`);
  res.json(rows);
});

router.post('/super-admin/meta-rate-cards', async (req, res) => {
  const { channelType, category, countryCode = '*', metaRate, currency = 'INR', gstPercent = 18.0, bspMarkup = 0, effectiveFrom } = req.body;
  if (!(Number(metaRate) >= 0)) return res.status(400).json({ error: 'metaRate must be a non-negative number' });

  try {
    await pool.query('BEGIN');
    await pool.query(
      `UPDATE meta_rate_cards SET active = false
        WHERE channel_type = $1 AND category = $2 AND country_code = $3 AND active = true`,
      [channelType, category, countryCode]
    );
    const { rows } = await pool.query(
      `INSERT INTO meta_rate_cards (channel_type, category, country_code, meta_rate, currency, gst_percent, bsp_markup, effective_from, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, CURRENT_DATE), true) RETURNING *`,
      [channelType, category, countryCode, metaRate, currency, gstPercent, bspMarkup, effectiveFrom || null]
    );
    await pool.query('COMMIT');
    await logSuperAdminAction(req, null, 'super_admin.meta_rate_card.update', { channelType, category, countryCode, metaRate });
    res.json(rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
});

// GET/PUT SMS rate cards — same pattern, separate table (different
// compliance shape, see sms_rate_cards' own comments).
router.get('/super-admin/sms-rate-cards', async (_req, res) => {
  const { rows } = await pool.query(`SELECT * FROM sms_rate_cards ORDER BY route_type`);
  res.json(rows);
});

router.post('/super-admin/sms-rate-cards', async (req, res) => {
  const { routeType, perSmsRate, currency = 'INR', gstPercent = 18.0, effectiveFrom } = req.body;
  if (!(Number(perSmsRate) >= 0)) return res.status(400).json({ error: 'perSmsRate must be a non-negative number' });

  try {
    await pool.query('BEGIN');
    await pool.query(`UPDATE sms_rate_cards SET active = false WHERE route_type = $1 AND active = true`, [routeType]);
    const { rows } = await pool.query(
      `INSERT INTO sms_rate_cards (route_type, per_sms_rate, currency, gst_percent, effective_from, active)
       VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_DATE), true) RETURNING *`,
      [routeType, perSmsRate, currency, gstPercent, effectiveFrom || null]
    );
    await pool.query('COMMIT');
    await logSuperAdminAction(req, null, 'super_admin.sms_rate_card.update', { routeType, perSmsRate });
    res.json(rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
});

// Markup config: the platform-wide default row (organizationId omitted)
// or a per-org override, if a BSP contract or negotiated deal means an
// org's pass-through markup differs from the default.
router.get('/super-admin/billing-markup', async (req, res) => {
  const { organizationId } = req.query;
  const { rows } = await pool.query(
    `SELECT * FROM billing_markup_config WHERE organization_id ${organizationId ? '= $1' : 'IS NULL'}`,
    organizationId ? [organizationId] : []
  );
  res.json(rows[0] || null);
});

router.put('/super-admin/billing-markup', async (req, res) => {
  const { organizationId = null, markupPercent } = req.body;
  if (!(Number(markupPercent) >= 0)) return res.status(400).json({ error: 'markupPercent must be a non-negative number' });

  // organization_id NULL (the platform default row) and a specific org's
  // override row live under two different partial unique indexes
  // (ux_billing_markup_default / ux_billing_markup_org — see migration
  // 025) — a single ON CONFLICT target can't cover both, so branch
  // explicitly instead of relying on one query to handle either case.
  const { rows } = organizationId
    ? await pool.query(
        `INSERT INTO billing_markup_config (organization_id, markup_percent, updated_by_admin, updated_at)
         VALUES ($1,$2,$3,now())
         ON CONFLICT (organization_id) WHERE organization_id IS NOT NULL
           DO UPDATE SET markup_percent = EXCLUDED.markup_percent, updated_by_admin = EXCLUDED.updated_by_admin, updated_at = now()
         RETURNING *`,
        [organizationId, markupPercent, req.admin.adminId]
      )
    : await pool.query(
        `INSERT INTO billing_markup_config (organization_id, markup_percent, updated_by_admin, updated_at)
         VALUES (NULL,$1,$2,now())
         ON CONFLICT ((organization_id IS NULL)) WHERE organization_id IS NULL
           DO UPDATE SET markup_percent = EXCLUDED.markup_percent, updated_by_admin = EXCLUDED.updated_by_admin, updated_at = now()
         RETURNING *`,
        [markupPercent, req.admin.adminId]
      );

  await logSuperAdminAction(req, organizationId, 'super_admin.billing_markup.update', { organizationId, markupPercent });
  res.json(rows[0]);
});

module.exports = router;
