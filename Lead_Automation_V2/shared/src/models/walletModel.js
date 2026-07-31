// shared/src/models/walletModel.js
//
// Prepaid wallet + ledger (section C). The deduction path needs a real
// row-lock inside a transaction so two concurrent WhatsApp sends can't
// both read balance=5, both decide "sufficient", and both deduct,
// leaving the balance negative — SELECT ... FOR UPDATE inside a
// transaction gives that.
//
// IMPORTANT: every function here runs its BEGIN/COMMIT/ROLLBACK through
// `pool.query()`, not `pool.connect()`. shared/src/db.js monkey-patches
// pool.query() to transparently route to whichever single connection
// withTenantScope()/withSystemAccess() already pinned via
// AsyncLocalStorage for the current call graph — that's how RLS's
// app.current_org / app.rls_bypass session GUCs actually reach these
// queries. pool.connect() grabs an *unrelated* raw connection from the
// pool with neither GUC set, which silently fails RLS closed (every
// query here returns zero rows, not an error) — that's exactly what
// happened during testing until this was caught: recharge() reported
// "No wallet for organization ..." on an organization that definitely
// had one. See index.js's /auth/register handler for the same
// pool.query('BEGIN')-based pattern this now follows.
//
// Practically: callers must invoke recharge()/deduct() from inside a
// withTenantScope(orgId, ...) or withSystemAccess() call — which
// requireSuperAdmin and the tenant authenticate middleware already set
// up for every request, so normal route handlers don't need to think
// about this. A bare unscoped call will correctly fail closed.

const { pool } = require('../db');

async function getWallet(organizationId) {
  const { rows } = await pool.query(`SELECT * FROM wallets WHERE organization_id = $1`, [organizationId]);
  return rows[0] || null;
}

// Super Admin manual top-up, or a payment-gateway webhook confirming a
// recharge. `adminId` is a platform_admins.id when triggered by staff;
// leave null for an automated/gateway-triggered recharge.
async function recharge(organizationId, amount, { referenceId, description, adminId } = {}) {
  if (!(amount > 0)) throw new Error('Recharge amount must be positive');

  try {
    await pool.query('BEGIN');

    const walletRes = await pool.query(
      `SELECT * FROM wallets WHERE organization_id = $1 FOR UPDATE`,
      [organizationId]
    );
    if (!walletRes.rows.length) throw new Error(`No wallet for organization ${organizationId}`);
    const wallet = walletRes.rows[0];
    const newBalance = Number(wallet.balance) + Number(amount);

    await pool.query(
      `UPDATE wallets
          SET balance = $2, lifetime_deposited = lifetime_deposited + $3, updated_at = now()
        WHERE organization_id = $1`,
      [organizationId, newBalance, amount]
    );

    const txRes = await pool.query(
      `INSERT INTO wallet_transactions
         (organization_id, type, amount, balance_after, reference_id, description, created_by_admin)
       VALUES ($1, 'RECHARGE', $2, $3, $4, $5, $6)
       RETURNING *`,
      [organizationId, amount, newBalance, referenceId || null, description || null, adminId || null]
    );

    await pool.query('COMMIT');
    return { wallet: { ...wallet, balance: newBalance }, transaction: txRes.rows[0] };
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

// Atomic usage deduction for a billable action (e.g. 1 WhatsApp message
// sent = credit_rates.whatsapp_message deducted). Throws
// InsufficientBalanceError if the wallet can't cover it — caller
// decides whether that blocks the action or just gets logged.
class InsufficientBalanceError extends Error {}

async function deduct(organizationId, actionKey, { referenceId, description, userId, quantity = 1 } = {}) {
  try {
    await pool.query('BEGIN');

    const walletRes = await pool.query(
      `SELECT * FROM wallets WHERE organization_id = $1 FOR UPDATE`,
      [organizationId]
    );
    if (!walletRes.rows.length) throw new Error(`No wallet for organization ${organizationId}`);
    const wallet = walletRes.rows[0];

    const rate = Number(wallet.credit_rates?.[actionKey]);
    if (!(rate >= 0)) throw new Error(`Unknown or misconfigured credit rate for action "${actionKey}"`);
    const amount = rate * quantity;

    if (Number(wallet.balance) < amount) {
      await pool.query('ROLLBACK');
      throw new InsufficientBalanceError(
        `Organization ${organizationId} balance ${wallet.balance} insufficient for ${amount} (${actionKey})`
      );
    }

    const newBalance = Number(wallet.balance) - amount;
    await pool.query(
      `UPDATE wallets
          SET balance = $2, lifetime_spent = lifetime_spent + $3, updated_at = now()
        WHERE organization_id = $1`,
      [organizationId, newBalance, amount]
    );

    const txRes = await pool.query(
      `INSERT INTO wallet_transactions
         (organization_id, type, amount, balance_after, reference_id, description, action_key, created_by_user)
       VALUES ($1, 'USAGE_DEDUCTION', $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [organizationId, amount, newBalance, referenceId || null, description || null, actionKey, userId || null]
    );

    await pool.query('COMMIT');

    return {
      wallet: { ...wallet, balance: newBalance },
      transaction: txRes.rows[0],
      lowBalance: newBalance < Number(wallet.low_balance_threshold),
    };
  } catch (e) {
    if (!(e instanceof InsufficientBalanceError)) {
      await pool.query('ROLLBACK').catch(() => {});
    }
    throw e;
  }
}

async function ledger(organizationId, { page = 1, pageSize = 50 } = {}) {
  const limit = Math.max(1, Math.min(pageSize, 200));
  const offset = (Math.max(1, page) - 1) * limit;
  const { rows } = await pool.query(
    `SELECT * FROM wallet_transactions
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [organizationId, limit, offset]
  );
  return rows;
}

// Global KPIs for the Super Admin dashboard header — section C bullet 1.
// Runs under withSystemAccess (see superAdminController.js), so this one
// legitimately reads across every tenant's wallet in one query.
async function globalFinancials() {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(lifetime_deposited), 0) AS total_revenue_collected,
       COALESCE(SUM(lifetime_spent), 0)     AS total_credits_spent,
       COALESCE(SUM(balance), 0)            AS total_active_balance,
       COUNT(*) FILTER (WHERE balance < low_balance_threshold)::int AS low_balance_org_count
     FROM wallets`
  );
  return rows[0];
}

module.exports = { getWallet, recharge, deduct, ledger, globalFinancials, InsufficientBalanceError };
