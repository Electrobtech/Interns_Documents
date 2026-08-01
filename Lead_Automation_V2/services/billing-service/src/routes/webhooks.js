// Razorpay calls this directly (no tenant JWT, no CORS-relevant browser
// origin), so it can't go through the normal `authenticate` middleware —
// trust is established purely via the X-Razorpay-Signature HMAC checked
// below. This is the SOURCE OF TRUTH for "did the money actually arrive":
// the /verify endpoints in wallet.js and checkout.js are just a faster
// same-tab confirmation for the browser, and both paths converge on the
// same paymentModel.markPaid() idempotency guard, so whichever fires first
// wins and this is never a double-credit even if both run.
//
// Mounted in index.js with express.raw() *before* express.json(), because
// the signature is computed over the exact bytes Razorpay sent — a
// JSON.parse() + re-stringify would very likely produce a byte-different
// (but semantically identical) body and fail the HMAC check.
const express = require('express');
const { pool, withSystemAccess, walletModel, paymentModel } = require('@lead/shared');
const { verifyWebhookSignature } = require('../lib/razorpay');

const router = express.Router();

router.post('/', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body; // Buffer, thanks to express.raw() in index.js

  if (!verifyWebhookSignature({ rawBody, signature })) {
    console.warn('[billing] webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      case 'payment_link.paid':
        await handlePaymentLinkPaid(event.payload.payment_link.entity, event.payload.payment?.entity);
        break;
      default:
        // Unhandled event types (e.g. refund.processed, order.paid) are
        // fine to ignore — 2xx tells Razorpay not to retry.
        break;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[billing] webhook processing failed', event.event, e);
    // 500 -> Razorpay retries with backoff, which is what we want for a
    // transient DB error rather than silently losing the event.
    res.status(500).json({ error: 'Processing failed' });
  }
});

// A regular Checkout order (wallet recharge or product-order checkout) was
// captured. Look the payment row up by the Razorpay order_id we stored
// when we created it.
async function handlePaymentCaptured(paymentEntity) {
  const record = await withSystemAccess(() => paymentModel.getByGatewayOrderId(paymentEntity.order_id));
  if (!record) {
    console.warn('[billing] payment.captured for unknown order_id', paymentEntity.order_id);
    return;
  }
  await settlePayment(record, paymentEntity.id);
}

async function handlePaymentFailed(paymentEntity) {
  const record = await withSystemAccess(() => paymentModel.getByGatewayOrderId(paymentEntity.order_id));
  if (!record) return;
  await withSystemAccess(() => paymentModel.markFailed(record.id, paymentEntity.error_description || 'Payment failed'));
}

// A walk-in Payment Link was paid. Payment Links use their own id
// namespace (plink_...), which is what we stored as gateway_order_id.
async function handlePaymentLinkPaid(linkEntity, paymentEntity) {
  const record = await withSystemAccess(() => paymentModel.getByGatewayOrderId(linkEntity.id));
  if (!record) {
    console.warn('[billing] payment_link.paid for unknown link', linkEntity.id);
    return;
  }
  await settlePayment(record, paymentEntity?.id || linkEntity.payments?.[0]?.payment_id);
}

// Shared "mark paid + apply the side effect" step. withSystemAccess is
// required here (not withTenantScope) because there is no authenticated
// user on this request — record.organization_id is only known *after*
// looking the row up, so RLS has to be bypassed for that lookup itself,
// same pattern walletModel.js's header comment describes for other
// system-triggered writes.
async function settlePayment(record, gatewayPaymentId) {
  await withSystemAccess(async () => {
    const updated = await paymentModel.markPaid(record.id, { gatewayPaymentId });
    if (!updated) return; // already settled via the /verify endpoint — nothing to do

    if (record.purpose === 'WALLET_RECHARGE') {
      await walletModel.recharge(record.organization_id, Number(record.amount), {
        referenceId: record.id,
        description: 'Razorpay wallet recharge (webhook)',
      });
    } else if (record.purpose === 'ECOMMERCE_ORDER' || record.purpose === 'WALKIN_SALE') {
      if (record.reference_id) {
        await pool.query(
          `UPDATE ecommerce_orders SET status = 'paid', payment_type = 'prepaid' WHERE id = $1 AND organization_id = $2`,
          [record.reference_id, record.organization_id]
        );
      }
    }
  });
}

module.exports = router;
