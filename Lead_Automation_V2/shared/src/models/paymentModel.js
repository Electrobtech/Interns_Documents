// shared/src/models/paymentModel.js
//
// Generic payment ledger row used by billing-service for every money
// movement that goes through Razorpay (or is logged manually by staff for
// a walk-in cash sale): wallet recharges, product-platform checkout, and
// walk-in POS sales. One table, distinguished by `purpose`, so the Super
// Admin financial views (and any future reconciliation job) have a single
// place to look instead of three gateway-specific tables.
//
// Same RLS caveat as walletModel.js: callers must be inside
// withTenantScope()/withSystemAccess(). Webhook handlers have no tenant
// JWT (Razorpay calls the endpoint directly), so they look the payment row
// up by gateway_order_id under withSystemAccess() first to discover which
// organization it belongs to, then act.

const { pool } = require('../db');

async function createPayment({
  organizationId,
  purpose, // WALLET_RECHARGE | ECOMMERCE_ORDER | WALKIN_SALE
  referenceId = null, // ecommerce_orders.id for ECOMMERCE_ORDER / WALKIN_SALE
  contactId = null,
  amount,
  currency = 'INR',
  method = null, // razorpay | cash | manual
  status = 'created',
  gateway = 'razorpay',
  gatewayOrderId = null,
  createdByUser = null,
  notes = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO payments
       (organization_id, purpose, reference_id, contact_id, amount, currency, method,
        status, gateway, gateway_order_id, created_by_user, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      organizationId, purpose, referenceId, contactId, amount, currency, method,
      status, gateway, gatewayOrderId, createdByUser,
      notes ? JSON.stringify(notes) : null,
    ]
  );
  return rows[0];
}

async function getById(id) {
  const { rows } = await pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function getByGatewayOrderId(gatewayOrderId) {
  const { rows } = await pool.query(
    `SELECT * FROM payments WHERE gateway_order_id = $1 LIMIT 1`,
    [gatewayOrderId]
  );
  return rows[0] || null;
}

async function getByGatewayPaymentId(gatewayPaymentId) {
  const { rows } = await pool.query(
    `SELECT * FROM payments WHERE gateway_payment_id = $1 LIMIT 1`,
    [gatewayPaymentId]
  );
  return rows[0] || null;
}

// Marks a payment row paid. Idempotent by design: the caller (routes or
// webhook) should check getByGatewayPaymentId() first, but this also
// guards with `AND status != 'paid'` so a duplicate webhook delivery (Razorpay
// retries on non-2xx, and can also just double-send) can never double-credit
// a wallet or double-fulfil an order — the second call simply updates 0 rows.
async function markPaid(paymentId, { gatewayPaymentId, gatewaySignature = null } = {}) {
  const { rows } = await pool.query(
    `UPDATE payments
        SET status = 'paid', gateway_payment_id = $2, gateway_signature = $3, updated_at = now()
      WHERE id = $1 AND status != 'paid'
      RETURNING *`,
    [paymentId, gatewayPaymentId, gatewaySignature]
  );
  return rows[0] || null; // null means it was already marked paid (or doesn't exist) — caller should treat as "nothing to do"
}

async function markFailed(paymentId, reason = null) {
  const { rows } = await pool.query(
    `UPDATE payments
        SET status = 'failed', notes = COALESCE(notes, '{}'::jsonb) || jsonb_build_object('failure_reason', $2::text), updated_at = now()
      WHERE id = $1 AND status NOT IN ('paid','refunded')
      RETURNING *`,
    [paymentId, reason]
  );
  return rows[0] || null;
}

async function markRefunded(paymentId, refundNotes = null) {
  const { rows } = await pool.query(
    `UPDATE payments
        SET status = 'refunded', notes = COALESCE(notes, '{}'::jsonb) || jsonb_build_object('refund', $2::jsonb), updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [paymentId, refundNotes ? JSON.stringify(refundNotes) : '{}']
  );
  return rows[0] || null;
}

async function list(organizationId, { page = 1, pageSize = 50, purpose } = {}) {
  const limit = Math.max(1, Math.min(pageSize, 200));
  const offset = (Math.max(1, page) - 1) * limit;
  const params = [organizationId];
  let where = `organization_id = $1`;
  if (purpose) {
    params.push(purpose);
    where += ` AND purpose = $${params.length}`;
  }
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM payments WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

module.exports = {
  createPayment,
  getById,
  getByGatewayOrderId,
  getByGatewayPaymentId,
  markPaid,
  markFailed,
  markRefunded,
  list,
};
