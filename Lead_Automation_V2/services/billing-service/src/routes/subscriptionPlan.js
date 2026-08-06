// services/billing-service/src/routes/subscriptionPlan.js
//
// Charges the tenant-level plan chosen on the registration wizard's
// Subscription step (`subscriptions` table — NOT the per-channel SaaS
// fees in channels.js, which is a separate concern). Same
// order -> Checkout.js -> verify/webhook pattern as everything else in
// this service (see channels.js's /subscription/checkout for the closest
// sibling implementation).
//
// Fixed pricing only — must match PLANS in
// frontend/src/components/registration/steps/Step6Subscription.jsx and
// PAID_PLAN_PRICES in services/auth-service/src/controllers/companyController.js.
// 'enterprise' has no entry here on purpose: it's sales-quoted ("Custom"),
// so there's no fixed amount to run through Checkout — that row is created
// 'active' at registration time instead (see companyController.js).
const express = require('express');
const { pool, requireRole, paymentModel } = require('@lead/shared');
const { razorpay, createOrder, toPaise, verifyCheckoutSignature, KEY_ID } = require('../lib/razorpay');

const router = express.Router();

const PLAN_PRICES = { starter: 1999, professional: 5999 };

// GET /billing/subscription-plan — current org's plan + payment status,
// for the app shell / billing settings page to show a "complete payment"
// banner if the wizard's checkout got interrupted.
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM subscriptions WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [req.user.organizationId]
  );
  const subscription = rows[0] || null;
  res.json({
    subscription,
    amountDue: subscription ? (PLAN_PRICES[subscription.plan] || null) : null,
    currency: 'INR',
  });
});

// Step 1: create a Razorpay order for the org's pending_payment plan.
router.post('/checkout', requireRole('owner', 'admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM subscriptions
      WHERE organization_id = $1 AND status = 'pending_payment'
      ORDER BY created_at DESC LIMIT 1`,
    [req.user.organizationId]
  );
  const subscription = rows[0];
  if (!subscription) return res.status(400).json({ error: 'Nothing pending payment.' });

  const amount = PLAN_PRICES[subscription.plan];
  if (!amount) {
    return res.status(400).json({ error: 'This plan has no fixed price — contact sales for an invoice.' });
  }

  try {
    const order = await createOrder({
      amount: toPaise(amount),
      currency: 'INR',
      notes: { organization_id: req.user.organizationId, purpose: 'SUBSCRIPTION', plan: subscription.plan },
    });

    const payment = await paymentModel.createPayment({
      organizationId: req.user.organizationId,
      purpose: 'SUBSCRIPTION',
      referenceId: subscription.id,
      amount,
      method: 'razorpay',
      status: 'created',
      gatewayOrderId: order.id,
      createdByUser: req.user.userId,
      notes: { plan: subscription.plan },
    });

    res.status(201).json({
      keyId: KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      paymentId: payment.id,
      plan: subscription.plan,
    });
  } catch (e) {
    console.error('[billing] subscription-plan checkout failed', e);
    res.status(502).json({ error: 'Could not create Razorpay order', detail: e.message });
  }
});

// Step 2: browser hands back the Checkout response. Verify the signature,
// then activate the plan. The webhook (routes/webhooks.js, SUBSCRIPTION
// case) is the source of truth and does the same activation if this call
// never fires (tab closed mid-flow) — both converge on
// paymentModel.markPaid()'s already-paid guard.
router.post('/verify', requireRole('owner', 'admin'), async (req, res) => {
  const { orderId, paymentId: gatewayPaymentId, signature, paymentId } = req.body;
  if (!orderId || !gatewayPaymentId || !signature) {
    return res.status(400).json({ error: 'orderId, paymentId, and signature are required' });
  }
  if (!verifyCheckoutSignature({ orderId, paymentId: gatewayPaymentId, signature })) {
    return res.status(400).json({ error: 'Signature verification failed' });
  }

  const record = paymentId
    ? await paymentModel.getById(paymentId)
    : await paymentModel.getByGatewayOrderId(orderId);
  if (!record || record.organization_id !== req.user.organizationId) {
    return res.status(404).json({ error: 'Payment record not found' });
  }
  if (record.purpose !== 'SUBSCRIPTION') {
    return res.status(400).json({ error: 'Payment record is not a subscription-plan charge' });
  }

  const updated = await paymentModel.markPaid(record.id, { gatewayPaymentId, gatewaySignature: signature });
  if (updated) {
    await pool.query(
      `UPDATE subscriptions SET status = 'active' WHERE id = $1 AND organization_id = $2`,
      [record.reference_id, req.user.organizationId]
    );
  }
  // If !updated, the webhook already beat us here and already activated
  // this row — either way, return the current state.

  const { rows } = await pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [record.reference_id]);
  res.json({ ok: true, subscription: rows[0] || null });
});

module.exports = router;