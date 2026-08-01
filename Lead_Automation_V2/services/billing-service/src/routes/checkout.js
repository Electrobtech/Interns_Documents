// Paid checkout for the product platform (ecommerce-service's
// `ecommerce_orders` table). Orders themselves are still created/edited via
// ecommerce-service (POST /orders) — this only handles taking payment
// against an order that already exists, and flips it to paid on success.
const express = require('express');
const { pool, paymentModel } = require('@lead/shared');
const { razorpay, toPaise, verifyCheckoutSignature, KEY_ID } = require('../lib/razorpay');

const router = express.Router();

async function getOrder(orderId, organizationId) {
  const { rows } = await pool.query(
    `SELECT * FROM ecommerce_orders WHERE id = $1 AND organization_id = $2`,
    [orderId, organizationId]
  );
  return rows[0] || null;
}

// Step 1: create a Razorpay order for an existing ecommerce order.
router.post('/:orderId/checkout', async (req, res) => {
  const order = await getOrder(req.params.orderId, req.user.organizationId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'paid') return res.status(400).json({ error: 'Order is already paid' });

  const amount = Number(order.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'Order has no payable amount' });

  try {
    const rpOrder = await razorpay.orders.create({
      amount: toPaise(amount),
      currency: 'INR',
      notes: { organization_id: req.user.organizationId, order_id: order.id, purpose: 'ECOMMERCE_ORDER' },
    });

    const payment = await paymentModel.createPayment({
      organizationId: req.user.organizationId,
      purpose: 'ECOMMERCE_ORDER',
      referenceId: order.id,
      contactId: order.contact_id,
      amount,
      method: 'razorpay',
      status: 'created',
      gatewayOrderId: rpOrder.id,
      createdByUser: req.user.userId,
    });

    res.status(201).json({
      keyId: KEY_ID,
      orderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      paymentId: payment.id,
    });
  } catch (e) {
    console.error('[billing] checkout order create failed', e);
    res.status(502).json({ error: 'Could not create Razorpay order', detail: e.message });
  }
});

// Step 2: verify Checkout's response and mark the order paid. The webhook
// is the source of truth for this too — see routes/webhooks.js.
router.post('/:orderId/verify', async (req, res) => {
  const { orderId: gatewayOrderId, paymentId: gatewayPaymentId, signature } = req.body;
  if (!gatewayOrderId || !gatewayPaymentId || !signature) {
    return res.status(400).json({ error: 'orderId, paymentId, and signature are required' });
  }
  if (!verifyCheckoutSignature({ orderId: gatewayOrderId, paymentId: gatewayPaymentId, signature })) {
    return res.status(400).json({ error: 'Signature verification failed' });
  }

  const record = await paymentModel.getByGatewayOrderId(gatewayOrderId);
  if (!record || record.organization_id !== req.user.organizationId || record.reference_id !== req.params.orderId) {
    return res.status(404).json({ error: 'Payment record not found for this order' });
  }

  const updated = await paymentModel.markPaid(record.id, { gatewayPaymentId, gatewaySignature: signature });
  if (updated) {
    await pool.query(
      `UPDATE ecommerce_orders SET status = 'paid', payment_type = 'prepaid' WHERE id = $1 AND organization_id = $2`,
      [req.params.orderId, req.user.organizationId]
    );
  }

  const order = await getOrder(req.params.orderId, req.user.organizationId);
  res.json({ ok: true, order });
});

module.exports = router;
