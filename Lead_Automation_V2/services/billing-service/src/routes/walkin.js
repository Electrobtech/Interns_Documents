// "Normal customer walk-ins" — in-person sales recorded by staff at a
// counter, not a self-serve online checkout. Two payment methods:
//   - cash: staff just logs it, marked paid immediately, no gateway call.
//   - qr:   a Razorpay Payment Link is created and rendered as a QR code
//           for the customer to scan and pay by UPI/card on their own
//           phone; the sale stays 'pending' until the webhook confirms it.
// Either way an ecommerce_orders row is created so walk-in sales show up
// in the same Orders list as online ones (payment_type distinguishes them:
// 'cash' vs 'prepaid').
const express = require('express');
const { pool, paymentModel } = require('@lead/shared');
const { razorpay, createPaymentLink, cancelPaymentLink, toPaise, KEY_ID } = require('../lib/razorpay');

const router = express.Router();

async function createOrder({ organizationId, contactId, amount, paymentType, status }) {
  const { rows } = await pool.query(
    `INSERT INTO ecommerce_orders (organization_id, contact_id, amount, payment_type, status)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [organizationId, contactId || null, amount, paymentType, status]
  );
  return rows[0];
}

router.post('/cash', async (req, res) => {
  const amount = Number(req.body.amount);
  const { contactId, description, customerName, customerPhone, customerEmail } = req.body;
  if (!(amount > 0)) return res.status(400).json({ error: 'amount must be a positive number' });
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });
  if (!customerPhone) return res.status(400).json({ error: 'customerPhone is required' });
  if (!customerEmail) return res.status(400).json({ error: 'customerEmail is required' });

  const order = await createOrder({
    organizationId: req.user.organizationId,
    contactId,
    amount,
    paymentType: 'cash',
    status: 'paid',
  });

  const payment = await paymentModel.createPayment({
    organizationId: req.user.organizationId,
    purpose: 'WALKIN_SALE',
    referenceId: order.id,
    contactId: contactId || null,
    amount,
    method: 'cash',
    status: 'paid',
    gateway: null,
    createdByUser: req.user.userId,
    notes: { description: description || null, customerName, customerPhone, customerEmail },
  });

  res.status(201).json({ order, payment });
});

router.post('/qr', async (req, res) => {
  const amount = Number(req.body.amount);
  const { contactId, description, customerName, customerPhone, customerEmail } = req.body;
  if (!(amount > 0)) return res.status(400).json({ error: 'amount must be a positive number' });
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });
  if (!customerPhone) return res.status(400).json({ error: 'customerPhone is required' });
  if (!customerEmail) return res.status(400).json({ error: 'customerEmail is required' });

  const order = await createOrder({
    organizationId: req.user.organizationId,
    contactId,
    amount,
    paymentType: 'prepaid',
    status: 'pending',
  });

  try {
    const link = await createPaymentLink({
      amount: toPaise(amount),
      currency: 'INR',
      description: description || 'Walk-in purchase',
      customer: {
        name: customerName || undefined,
        contact: customerPhone || undefined,
        email: customerEmail || undefined,
      },
      notify: { sms: !!customerPhone, email: !!customerEmail },
      reminder_enable: false,
      notes: { organization_id: req.user.organizationId, order_id: order.id, purpose: 'WALKIN_SALE' },
    });

    const payment = await paymentModel.createPayment({
      organizationId: req.user.organizationId,
      purpose: 'WALKIN_SALE',
      referenceId: order.id,
      contactId: contactId || null,
      amount,
      method: 'razorpay',
      status: 'created',
      gatewayOrderId: link.id,
      createdByUser: req.user.userId,
      notes: { short_url: link.short_url, description: description || null, customerName, customerPhone, customerEmail },
    });

    res.status(201).json({
      order,
      paymentId: payment.id,
      shortUrl: link.short_url,
      // Rendered client-side as an <img>, no extra QR dependency needed —
      // this public endpoint just turns any URL into a scannable PNG.
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(link.short_url)}`,
    });
  } catch (e) {
    console.error('[billing] payment link create failed', e);
    // Don't leave an orphaned pending order behind if Razorpay call failed.
    await pool.query(`DELETE FROM ecommerce_orders WHERE id = $1`, [order.id]);
    res.status(502).json({ error: 'Could not create payment link', detail: e.message });
  }
});

// Frontend polls this while the QR is on screen; the webhook is what
// actually flips the status, this just reads current DB state.
router.get('/:paymentId/status', async (req, res) => {
  const payment = await paymentModel.getById(req.params.paymentId);
  if (!payment || payment.organization_id !== req.user.organizationId) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  res.json({ status: payment.status, payment });
});

router.post('/:paymentId/cancel', async (req, res) => {
  const payment = await paymentModel.getById(req.params.paymentId);
  if (!payment || payment.organization_id !== req.user.organizationId) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  if (payment.status === 'paid') return res.status(400).json({ error: 'Already paid, cannot cancel' });

  if (payment.gateway_order_id) {
    try {
      await cancelPaymentLink(payment.gateway_order_id);
    } catch (e) {
      console.warn('[billing] payment link cancel failed (may already be expired)', e.message);
    }
  }
  await paymentModel.markFailed(payment.id, 'Cancelled at counter');
  if (payment.reference_id) {
    await pool.query(
      `UPDATE ecommerce_orders SET status = 'cancelled' WHERE id = $1 AND organization_id = $2`,
      [payment.reference_id, req.user.organizationId]
    );
  }
  res.json({ ok: true });
});

module.exports = router;