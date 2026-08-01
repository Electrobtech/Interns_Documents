// Wallet recharge — this is what keeps campaigns/broadcasts running, since
// every WhatsApp send / workflow execution debits the org's wallet
// (see shared/src/models/walletModel.js `deduct()`). Self-serve version of
// the existing Super Admin manual top-up in auth-service's
// superAdminController.js — same walletModel.recharge(), just triggered by
// a real payment instead of platform staff.
const express = require('express');
const { requireRole, walletModel, paymentModel } = require('@lead/shared');
const { razorpay, toPaise, verifyCheckoutSignature, KEY_ID } = require('../lib/razorpay');

const router = express.Router();

// Suggested top-up amounts shown as quick-pick buttons in the recharge
// modal — purely a frontend convenience, any positive amount is accepted.
const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

router.get('/', async (req, res) => {
  const wallet = await walletModel.getWallet(req.user.organizationId);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found for this organization' });
  res.json({ ...wallet, quickAmounts: QUICK_AMOUNTS });
});

router.get('/ledger', async (req, res) => {
  const { page, pageSize } = req.query;
  const rows = await walletModel.ledger(req.user.organizationId, {
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });
  res.json(rows);
});

// Step 1: create a Razorpay order for the top-up amount. Only admin/manager
// can initiate a recharge — agents can spend wallet balance (by sending
// messages) but shouldn't be moving company money.
router.post('/recharge-order', requireRole('admin', 'manager'), async (req, res) => {
  const amount = Number(req.body.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'amount must be a positive number' });
  if (amount < 1) return res.status(400).json({ error: 'Minimum recharge amount is ₹1' });

  try {
    const order = await razorpay.orders.create({
      amount: toPaise(amount),
      currency: 'INR',
      notes: { organization_id: req.user.organizationId, purpose: 'WALLET_RECHARGE' },
    });

    const payment = await paymentModel.createPayment({
      organizationId: req.user.organizationId,
      purpose: 'WALLET_RECHARGE',
      amount,
      method: 'razorpay',
      status: 'created',
      gatewayOrderId: order.id,
      createdByUser: req.user.userId,
    });

    res.status(201).json({
      keyId: KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      paymentId: payment.id,
    });
  } catch (e) {
    console.error('[billing] recharge-order failed', e);
    res.status(502).json({ error: 'Could not create Razorpay order', detail: e.message });
  }
});

// Step 2: browser hands back the Razorpay Checkout response after the user
// completes payment. Verify the signature, then credit the wallet.
// The webhook (routes/webhooks.js) is the source of truth and will also
// credit the wallet if this call never happens (tab closed mid-flow) — both
// paths go through paymentModel.markPaid()'s `status != 'paid'` guard, so
// whichever arrives first wins and the second is a no-op.
router.post('/verify', async (req, res) => {
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
  if (record.purpose !== 'WALLET_RECHARGE') {
    return res.status(400).json({ error: 'Payment record is not a wallet recharge' });
  }

  const updated = await paymentModel.markPaid(record.id, { gatewayPaymentId, gatewaySignature: signature });
  if (!updated) {
    // Already paid (webhook beat us here) — still return the current wallet state.
    const wallet = await walletModel.getWallet(req.user.organizationId);
    return res.json({ alreadyProcessed: true, wallet });
  }

  const result = await walletModel.recharge(req.user.organizationId, Number(record.amount), {
    referenceId: record.id,
    description: 'Razorpay wallet recharge',
  });

  res.json({ ok: true, wallet: result.wallet, transaction: result.transaction });
});

module.exports = router;
