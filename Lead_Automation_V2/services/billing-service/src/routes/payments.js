// General payment history (wallet recharges + product orders + walk-ins
// together) for a Billing settings page, plus refunds.
const express = require('express');
const { requireRole, paymentModel } = require('@lead/shared');
const { razorpay, toPaise } = require('../lib/razorpay');

const router = express.Router();

router.get('/', async (req, res) => {
  const { page, pageSize, purpose } = req.query;
  const rows = await paymentModel.list(req.user.organizationId, {
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
    purpose: purpose || undefined,
  });
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const payment = await paymentModel.getById(req.params.id);
  if (!payment || payment.organization_id !== req.user.organizationId) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  res.json(payment);
});

// Full or partial refund of a captured payment. Admin/manager only — this
// moves real money back out.
router.post('/:id/refund', requireRole('admin', 'manager'), async (req, res) => {
  const payment = await paymentModel.getById(req.params.id);
  if (!payment || payment.organization_id !== req.user.organizationId) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  if (payment.status !== 'paid') return res.status(400).json({ error: 'Only a paid payment can be refunded' });
  if (!payment.gateway_payment_id) return res.status(400).json({ error: 'No gateway payment to refund (e.g. a cash sale) — adjust manually instead' });

  const refundAmount = req.body.amount ? Number(req.body.amount) : Number(payment.amount);
  if (!(refundAmount > 0) || refundAmount > Number(payment.amount)) {
    return res.status(400).json({ error: 'Invalid refund amount' });
  }

  try {
    const refund = await razorpay.payments.refund(payment.gateway_payment_id, {
      amount: toPaise(refundAmount),
      notes: { organization_id: req.user.organizationId, reason: req.body.reason || 'Requested by staff' },
    });
    const updated = await paymentModel.markRefunded(payment.id, {
      refund_id: refund.id,
      amount: refundAmount,
      reason: req.body.reason || null,
    });
    res.json({ ok: true, refund, payment: updated });
  } catch (e) {
    console.error('[billing] refund failed', e);
    res.status(502).json({ error: 'Refund failed', detail: e.message });
  }
});

module.exports = router;
