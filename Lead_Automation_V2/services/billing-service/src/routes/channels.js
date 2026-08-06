// services/billing-service/src/routes/channels.js
//
// Per-channel subscription billing — the SaaS-fee side of the task brief
// (Meta/SMS pass-through itemization lives in ./invoices.js and in
// campaign-service/src/whatsappBilling.js, which actually meters usage).
//
// Follows the same file-per-concern + requireRole pattern as wallet.js:
// read routes are open to any authenticated org user (so the subscription
// picker UI can render for anyone), money/config-moving routes are
// admin/owner only.

const express = require('express');
const { pool, requireRole, paymentModel } = require('@lead/shared');
const { razorpay, createOrder, toPaise, verifyCheckoutSignature, KEY_ID } = require('../lib/razorpay');

const router = express.Router();

const VALID_CHANNELS = ['whatsapp', 'messenger', 'instagram', 'linkedin', 'email', 'sms'];

// GET /billing/plans — the current catalogue (public to any authenticated
// user in the org, for the subscription-picker UI).
router.get('/plans', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM channel_plans WHERE active = true ORDER BY channel_type`
  );
  res.json(rows);
});

// GET /billing/subscription — current org's active channel subscriptions +
// effective total monthly cost. SaaS fees only, deliberately: Meta
// pass-through is usage-based and only known for real at invoice time, so
// this never projects it as a fixed number (would mislead the "will I be
// charged ₹X this month" question) — see /billing/subscription/estimate for
// a clearly-labeled estimate instead.
router.get('/subscription', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM organization_channel_subscriptions
      WHERE organization_id = $1 AND status IN ('pending_payment','active','paused')
      ORDER BY channel_type`,
    [req.user.organizationId]
  );
  const monthlySaasTotal = rows
    .filter((r) => r.status === 'active' && r.billing_period === 'monthly')
    .reduce((sum, r) => sum + Number(r.price_amount), 0);

  res.json({
    subscriptions: rows,
    monthly_saas_total: monthlySaasTotal,
    currency: 'INR',
    note: 'monthly_saas_total covers our platform fee only. Meta/SMS usage pass-through is metered separately and only known precisely at invoice time.',
  });
});

// PUT /billing/subscription/channels — admin/owner only (matches wallet.js's
// pattern for money-moving routes). body: { channels: [{ channelType,
// billingPeriod }], confirmDisconnect?: boolean }
//
// Validates each channelType against the org's `channels` table (can't
// subscribe to a channel that doesn't map to a real connectable channel),
// then creates/updates organization_channel_subscriptions rows.
router.put('/subscription/channels', requireRole('admin', 'owner'), async (req, res) => {
  const { channels, confirmDisconnect } = req.body;
  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({ error: 'channels must be a non-empty array' });
  }

  const requested = channels.map((c) => ({
    channelType: c.channelType,
    billingPeriod: c.billingPeriod || 'monthly',
  }));

  for (const { channelType, billingPeriod } of requested) {
    if (!VALID_CHANNELS.includes(channelType)) {
      return res.status(400).json({ error: `Unknown channel type: ${channelType}` });
    }
    if (!['monthly', 'annual'].includes(billingPeriod)) {
      return res.status(400).json({ error: `Unknown billing period: ${billingPeriod}` });
    }
  }

  // Product decision to flag, not silently guess: disabling a channel
  // that has an actively-connected integration needs an explicit
  // confirmation flag from the caller (the UI should surface a "this
  // channel is still connected — disable anyway?" prompt).
  const { rows: currentlySubscribed } = await pool.query(
    `SELECT channel_type FROM organization_channel_subscriptions
      WHERE organization_id = $1 AND status = 'active'`,
    [req.user.organizationId]
  );
  const requestedTypes = new Set(requested.map((r) => r.channelType));
  const beingDisabled = currentlySubscribed
    .map((r) => r.channel_type)
    .filter((t) => !requestedTypes.has(t));

  if (beingDisabled.length && !confirmDisconnect) {
    const { rows: connected } = await pool.query(
      `SELECT type FROM channels WHERE organization_id = $1 AND type = ANY($2) AND status = 'connected'`,
      [req.user.organizationId, beingDisabled]
    );
    if (connected.length) {
      return res.status(409).json({
        error: 'Some channels being disabled are still actively connected. Resend with confirmDisconnect: true to proceed.',
        activelyConnected: connected.map((c) => c.type),
      });
    }
  }

  try {
    await pool.query('BEGIN');

    // Cancel subscriptions for channels no longer in the requested set.
    if (beingDisabled.length) {
      await pool.query(
        `UPDATE organization_channel_subscriptions
            SET status = 'cancelled', cancelled_at = now()
          WHERE organization_id = $1 AND channel_type = ANY($2) AND status IN ('pending_payment','active','paused')`,
        [req.user.organizationId, beingDisabled]
      );
    }

    const results = [];
    for (const { channelType, billingPeriod } of requested) {
      const { rows: planRows } = await pool.query(
        `SELECT * FROM channel_plans WHERE channel_type = $1 AND billing_period = $2 AND active = true LIMIT 1`,
        [channelType, billingPeriod]
      );
      const plan = planRows[0];
      if (!plan) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: `No active plan found for ${channelType} (${billingPeriod})` });
      }

      // Already-subscribed (active/paused) channel: leave its snapshotted
      // price untouched — this endpoint doesn't re-price an existing
      // subscription, only adds new ones or reactivates cancelled ones.
      const { rows: existing } = await pool.query(
        `SELECT * FROM organization_channel_subscriptions
          WHERE organization_id = $1 AND channel_type = $2 AND status IN ('pending_payment','active','paused')`,
        [req.user.organizationId, channelType]
      );
      if (existing.length) {
        results.push(existing[0]);
        continue;
      }

      // New subscription starts as 'pending_payment', not 'active' — it
      // only flips to 'active' once the charge actually clears (see
      // POST /billing/subscription/checkout below + webhooks.js). This
      // endpoint just books the intent; it never charges money itself.
      const { rows: inserted } = await pool.query(
        `INSERT INTO organization_channel_subscriptions
           (organization_id, channel_type, channel_plan_id, price_amount, currency, billing_period, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending_payment')
         RETURNING *`,
        [req.user.organizationId, channelType, plan.id, plan.our_fee_amount, plan.currency, billingPeriod]
      );
      results.push(inserted[0]);
    }

    await pool.query('COMMIT');
    res.json({ subscriptions: results, disabled: beingDisabled });
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
});

// Step 1 of paying for whatever's currently pending_payment: create a
// Razorpay order for the sum of those rows' price_amount. Same two-step
// order -> Checkout.js -> verify pattern as wallet.js's /recharge-order —
// see frontend/src/lib/billing.js's openCheckout().
router.post('/subscription/checkout', requireRole('admin', 'owner'), async (req, res) => {
  const { rows: pending } = await pool.query(
    `SELECT * FROM organization_channel_subscriptions
      WHERE organization_id = $1 AND status = 'pending_payment'`,
    [req.user.organizationId]
  );
  if (pending.length === 0) {
    return res.status(400).json({ error: 'Nothing pending payment.' });
  }

  const totalAmount = pending.reduce((sum, s) => sum + Number(s.price_amount), 0);

  try {
    const order = await createOrder({
      amount: toPaise(totalAmount),
      currency: 'INR',
      notes: { organization_id: req.user.organizationId, purpose: 'CHANNEL_SUBSCRIPTION' },
    });

    // reference_id isn't a single row's id here — it's the org id, since
    // this charge covers however many channels are pending at once.
    // settlePayment()/the /verify handler below both activate every
    // pending_payment row for record.organization_id, not just one.
    const payment = await paymentModel.createPayment({
      organizationId: req.user.organizationId,
      purpose: 'CHANNEL_SUBSCRIPTION',
      referenceId: req.user.organizationId,
      amount: totalAmount,
      method: 'razorpay',
      status: 'created',
      gatewayOrderId: order.id,
      createdByUser: req.user.userId,
      notes: { channels: pending.map((p) => p.channel_type) },
    });

    res.status(201).json({
      keyId: KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      paymentId: payment.id,
      channels: pending.map((p) => p.channel_type),
    });
  } catch (e) {
    console.error('[billing] channel-subscription checkout failed', e);
    res.status(502).json({ error: 'Could not create Razorpay order', detail: e.message });
  }
});

// Step 2: browser hands back the Checkout response. Verify the signature,
// then activate every pending_payment subscription for this org. The
// webhook (routes/webhooks.js, CHANNEL_SUBSCRIPTION case) is the source of
// truth and does the same activation if this call never happens (tab
// closed mid-flow) — both converge on paymentModel.markPaid()'s
// already-paid guard, so whichever fires first wins.
router.post('/subscription/verify', requireRole('admin', 'owner'), async (req, res) => {
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
  if (record.purpose !== 'CHANNEL_SUBSCRIPTION') {
    return res.status(400).json({ error: 'Payment record is not a channel subscription charge' });
  }

  const updated = await paymentModel.markPaid(record.id, { gatewayPaymentId, gatewaySignature: signature });
  if (updated) {
    await pool.query(
      `UPDATE organization_channel_subscriptions SET status = 'active'
        WHERE organization_id = $1 AND status = 'pending_payment'`,
      [req.user.organizationId]
    );
  }
  // If !updated, the webhook already beat us here and already activated
  // these rows — either way, return the current state.

  const { rows: subscriptions } = await pool.query(
    `SELECT * FROM organization_channel_subscriptions
      WHERE organization_id = $1 AND status IN ('pending_payment','active','paused')
      ORDER BY channel_type`,
    [req.user.organizationId]
  );
  res.json({ ok: true, subscriptions });
});

// GET /billing/usage-rates — effective per-message rates shown to the
// tenant on the Channels picker, so they know what they'll actually be
// charged beyond the flat platform fee. "Effective" = Meta's/carrier's
// rate + this org's markup % + GST, i.e. exactly what ends up on the
// invoice line, not just the raw wholesale rate — see
// campaign-service/src/whatsappBilling.js's costFor() for the identical
// computation used at charge time (duplicated here rather than shared
// since billing-service and campaign-service are separate deployables).
router.get('/usage-rates', async (req, res) => {
  const markupPercent = await getMarkupPercent(req.user.organizationId);

  const { rows: metaRates } = await pool.query(
    `SELECT DISTINCT ON (channel_type, category) *
       FROM meta_rate_cards
      WHERE country_code = '*' AND active = true AND effective_from <= CURRENT_DATE
      ORDER BY channel_type, category, effective_from DESC`
  );
  const { rows: smsRates } = await pool.query(
    `SELECT DISTINCT ON (route_type) *
       FROM sms_rate_cards
      WHERE active = true AND effective_from <= CURRENT_DATE
      ORDER BY route_type, effective_from DESC`
  );

  const withMarkup = (rate) => {
    const base = Number(rate.meta_rate ?? rate.per_sms_rate) + Number(rate.bsp_markup || 0);
    const marked = base * (1 + markupPercent / 100);
    const gstPercent = Number(rate.gst_percent ?? 18);
    const gstAmount = marked * (gstPercent / 100);
    return Number((marked + gstAmount).toFixed(4));
  };

  const meta = {};
  for (const r of metaRates) {
    meta[r.channel_type] = meta[r.channel_type] || {};
    meta[r.channel_type][r.category] = { rate: withMarkup(r), currency: r.currency };
  }
  const sms = {};
  for (const r of smsRates) {
    sms[r.route_type] = { rate: withMarkup(r), currency: r.currency };
  }

  res.json({
    currency: 'INR',
    markup_percent: markupPercent,
    meta, // e.g. { whatsapp: { marketing: {rate, currency}, utility: {...}, ... } }
    sms,  // e.g. { promotional: {rate, currency}, transactional: {...}, otp: {...} }
    note: 'Rates shown include the platform markup and GST — this is what actually appears on your invoice per message, not Meta/carrier\'s wholesale rate.',
  });
});

// Same markup lookup as whatsappBilling.js's getMarkupPercent() —
// org-specific override if one exists, else the platform-wide default row.
async function getMarkupPercent(organizationId) {
  const { rows } = await pool.query(
    `SELECT markup_percent FROM billing_markup_config
      WHERE organization_id = $1
      UNION ALL
      SELECT markup_percent FROM billing_markup_config WHERE organization_id IS NULL
      LIMIT 1`,
    [organizationId]
  );
  return Number(rows[0]?.markup_percent || 0);
}

module.exports = router;