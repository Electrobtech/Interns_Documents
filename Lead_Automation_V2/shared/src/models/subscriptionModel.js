// shared/src/models/subscriptionModel.js
//
// Module 2 (part 1) — Subscription Management. One row per organization
// (see infra/db/migrations/027_subscription_billing.sql for why this is
// a UNIQUE(organization_id) row updated in place, not a history table).
//
// IMPORTANT — keeping two plan fields in sync: `organizations.subscription_plan`
// existed before this module (companyController.js sets it at registration,
// and PATCH /super-admin/companies/:id/plan already updates it) and is read
// by CompanyManagementTable's "Plan" column. This module's `subscriptions.plan`
// is the same logical value but with actual billing fields attached to it.
// Every write path here updates BOTH columns in the same statement/transaction
// so they cannot drift — see updatePlan() below, and the equivalent fix made
// to companyModel.updateSubscriptionPlan's caller in superAdminController.js.

const { pool } = require('../db');

const VALID_STATUSES = ['trialing', 'active', 'past_due', 'canceled'];
const VALID_CYCLES = ['monthly', 'yearly'];

function addCycle(date, billingCycle) {
  const d = new Date(date);
  if (billingCycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

async function getByOrg(organizationId) {
  const { rows } = await pool.query(`SELECT * FROM subscriptions WHERE organization_id = $1`, [organizationId]);
  return rows[0] || null;
}

// Super Admin governance action — change plan/billing cycle/amount/
// auto-billing. Any field omitted is left unchanged. Writes through to
// organizations.subscription_plan in the same query when `plan` is given,
// per the header note.
async function updatePlan(organizationId, { plan, billingCycle, amount, autoBilling, adminId } = {}) {
  if (billingCycle !== undefined && !VALID_CYCLES.includes(billingCycle)) {
    throw new Error(`Invalid billingCycle "${billingCycle}". Expected one of: ${VALID_CYCLES.join(', ')}`);
  }
  if (amount !== undefined && !(Number(amount) >= 0)) {
    throw new Error('amount must be a non-negative number');
  }

  try {
    await pool.query('BEGIN');

    const { rows } = await pool.query(
      `UPDATE subscriptions
          SET plan          = COALESCE($2, plan),
              billing_cycle = COALESCE($3, billing_cycle),
              amount        = COALESCE($4, amount),
              auto_billing  = COALESCE($5, auto_billing),
              updated_by_admin = $6,
              updated_at    = now()
        WHERE organization_id = $1
        RETURNING *`,
      [organizationId, plan || null, billingCycle || null, amount ?? null, autoBilling === undefined ? null : autoBilling, adminId || null]
    );
    if (!rows.length) throw new Error(`No subscription row for organization ${organizationId}`);

    if (plan) {
      await pool.query(
        `UPDATE organizations SET subscription_plan = $2, updated_at = now() WHERE id = $1`,
        [organizationId, plan]
      );
    }

    await pool.query('COMMIT');
    return rows[0];
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

// Status transitions (active / past_due / canceled). Canceling stamps
// canceled_at; reactivating clears it.
async function updateStatus(organizationId, status, { adminId } = {}) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status "${status}". Expected one of: ${VALID_STATUSES.join(', ')}`);
  }
  const { rows } = await pool.query(
    `UPDATE subscriptions
        SET status = $2,
            canceled_at = CASE WHEN $2 = 'canceled' THEN now() ELSE NULL END,
            updated_by_admin = $3,
            updated_at = now()
      WHERE organization_id = $1
      RETURNING *`,
    [organizationId, status, adminId || null]
  );
  if (!rows.length) throw new Error(`No subscription row for organization ${organizationId}`);
  return rows[0];
}

// Advances the billing period forward by one cycle — called after a
// successful renewal charge (manual "Renew now" from Super Admin, or a
// future auto-billing job). Does NOT itself create a payment/invoice;
// callers pair this with paymentModel.createPayment(...) +
// invoiceModel.generateForSubscription(...) so the three stay consistent
// with each other, same separation-of-concerns as walletModel.recharge()
// vs. the route handler that logs the audit entry.
async function renew(organizationId, { adminId } = {}) {
  const { rows } = await pool.query(
    `UPDATE subscriptions
        SET current_period_start = current_period_end,
            current_period_end   = CASE WHEN billing_cycle = 'yearly'
                                         THEN current_period_end + INTERVAL '1 year'
                                         ELSE current_period_end + INTERVAL '1 month' END,
            status = 'active',
            updated_by_admin = $2,
            updated_at = now()
      WHERE organization_id = $1
      RETURNING *`,
    [organizationId, adminId || null]
  );
  if (!rows.length) throw new Error(`No subscription row for organization ${organizationId}`);
  return rows[0];
}

// Cross-tenant list for a platform billing view — renewals due soon,
// past_due tenants, etc.
async function listDueForRenewal({ withinDays = 7 } = {}) {
  const { rows } = await pool.query(
    `SELECT s.*, o.name AS organization_name
       FROM subscriptions s
       JOIN organizations o ON o.id = s.organization_id
      WHERE s.status IN ('active', 'past_due')
        AND s.current_period_end <= current_date + $1::int
      ORDER BY s.current_period_end ASC`,
    [withinDays]
  );
  return rows;
}

async function platformSummary() {
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS mrr_component
       FROM subscriptions
      GROUP BY status`
  );
  return rows;
}

module.exports = {
  VALID_STATUSES,
  VALID_CYCLES,
  getByOrg,
  updatePlan,
  updateStatus,
  renew,
  listDueForRenewal,
  platformSummary,
  addCycle,
};
