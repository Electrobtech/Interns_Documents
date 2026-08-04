// services/billing-service/src/routes/invoices.js
//
// Itemized invoices for channel-subscription billing: our SaaS fee per
// channel + Meta/SMS pass-through, as separate line_items rows (never one
// lump total) — per the task brief's "obvious we're not marking that part
// up" auditability requirement.
//
// The monthly generation job aggregates that period's
// organization_channel_subscriptions fees + that period's
// meta_usage_charges/sms_usage_charges into a new invoices row + its
// invoice_line_items, then reuses the existing wallet-debit pattern from
// wallet.js/walletModel.js — this repo's billing already runs on prepaid
// wallet balance for usage (WhatsApp sends, workflow runs), so an invoice
// is settled the same way rather than introducing a second payment path.
// If a wallet has insufficient balance, the invoice is left 'pending' and
// a Razorpay payment link is created instead (mirrors checkout.js).

const express = require('express');
const { pool, requireRole, paymentModel } = require('@lead/shared');
const { razorpay, toPaise, KEY_ID } = require('../lib/razorpay');

const router = express.Router();

// GET /billing/invoices — list, most recent first.
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, amount, currency, status, billing_period_start, billing_period_end, created_at
       FROM invoices WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.organizationId]
  );
  res.json(rows);
});

// GET /billing/invoices/:id — itemized invoice, broken into the three line
// types (saas_channel_fee / meta_passthrough / sms_passthrough / bsp_markup).
router.get('/:id', async (req, res) => {
  const { rows: invRows } = await pool.query(
    `SELECT * FROM invoices WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.organizationId]
  );
  const invoice = invRows[0];
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const { rows: lineItems } = await pool.query(
    `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY type, channel_type`,
    [invoice.id]
  );

  res.json({
    ...invoice,
    line_items: lineItems.map((li) => ({
      ...li,
      // Explicit labeling per task brief: "clearly labeled 'Platform fee'"
      // vs "clearly labeled 'Meta usage fee — passed through at cost'".
      // NOTE: the markup product decision landed on "markup on top, not
      // exact cost" — so this label says "at our published rate" rather
      // than implying zero markup. Update this string if that decision
      // changes.
      label: li.type === 'saas_channel_fee' ? 'Platform fee'
        : li.type === 'meta_passthrough' ? 'Meta usage fee — passed through at our published rate'
        : li.type === 'sms_passthrough' ? 'SMS carrier fee — passed through at our published rate'
        : li.type === 'bsp_markup' ? 'BSP markup'
        : 'Other',
    })),
  });
});

// POST /billing/invoices/generate — admin-only monthly job (cron or manual
// trigger). body: { periodStart: 'YYYY-MM-DD', periodEnd: 'YYYY-MM-DD' }
// (defaults to the previous calendar month if omitted). For each org with
// active subscriptions or uninvoiced usage in that period: sums SaaS fees
// + aggregates meta_usage_charges/sms_usage_charges, writes invoices +
// invoice_line_items, then settles via wallet debit if the balance covers
// it, else creates a Razorpay payment link.
router.post('/generate', requireRole('admin'), async (req, res) => {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const periodStart = req.body.periodStart || defaultStart.toISOString().slice(0, 10);
  const periodEnd = req.body.periodEnd || defaultEnd.toISOString().slice(0, 10);

  const organizationId = req.user.organizationId;

  const { rows: subs } = await pool.query(
    `SELECT * FROM organization_channel_subscriptions
      WHERE organization_id = $1 AND status = 'active'
        AND (trial_ends_at IS NULL OR trial_ends_at < $2::date)`,
    [organizationId, periodStart]
  );

  const { rows: metaCharges } = await pool.query(
    `SELECT channel_type, category, SUM(quantity) AS quantity, SUM(total_amount) AS total_amount
       FROM meta_usage_charges
      WHERE organization_id = $1 AND period >= $2::date AND period <= $3::date AND NOT invoiced
      GROUP BY channel_type, category`,
    [organizationId, periodStart, periodEnd]
  );

  const { rows: smsCharges } = await pool.query(
    `SELECT route_type, SUM(quantity) AS quantity, SUM(total_amount) AS total_amount
       FROM sms_usage_charges
      WHERE organization_id = $1 AND period >= $2::date AND period <= $3::date AND NOT invoiced
      GROUP BY route_type`,
    [organizationId, periodStart, periodEnd]
  );

  const lineItems = [
    ...subs.map((s) => ({
      type: 'saas_channel_fee',
      channel_type: s.channel_type,
      description: `${s.channel_type} platform fee — ${s.billing_period}`,
      quantity: 1,
      unit_amount: Number(s.price_amount),
      total_amount: Number(s.price_amount),
    })),
    ...metaCharges.map((c) => ({
      type: 'meta_passthrough',
      channel_type: c.channel_type,
      description: `${c.channel_type} Meta usage fee — ${c.category} (${c.quantity} messages)`,
      quantity: Number(c.quantity),
      unit_amount: Number(c.total_amount) / Number(c.quantity),
      total_amount: Number(c.total_amount),
    })),
    ...smsCharges.map((c) => ({
      type: 'sms_passthrough',
      channel_type: 'sms',
      description: `SMS carrier fee — ${c.route_type} (${c.quantity} messages)`,
      quantity: Number(c.quantity),
      unit_amount: Number(c.total_amount) / Number(c.quantity),
      total_amount: Number(c.total_amount),
    })),
  ];

  if (lineItems.length === 0) {
    return res.json({ message: 'Nothing to invoice for this org/period.', periodStart, periodEnd });
  }

  const totalAmount = lineItems.reduce((sum, li) => sum + li.total_amount, 0);

  try {
    await pool.query('BEGIN');

    const { rows: invRows } = await pool.query(
      `INSERT INTO invoices (organization_id, amount, currency, status, billing_period_start, billing_period_end)
       VALUES ($1,$2,'INR','pending',$3,$4) RETURNING *`,
      [organizationId, totalAmount.toFixed(2), periodStart, periodEnd]
    );
    const invoice = invRows[0];

    for (const li of lineItems) {
      await pool.query(
        `INSERT INTO invoice_line_items (invoice_id, type, channel_type, description, quantity, unit_amount, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [invoice.id, li.type, li.channel_type, li.description, li.quantity, li.unit_amount.toFixed(2), li.total_amount.toFixed(2)]
      );
    }

    await pool.query(
      `UPDATE meta_usage_charges SET invoiced = true
        WHERE organization_id = $1 AND period >= $2::date AND period <= $3::date AND NOT invoiced`,
      [organizationId, periodStart, periodEnd]
    );
    await pool.query(
      `UPDATE sms_usage_charges SET invoiced = true
        WHERE organization_id = $1 AND period >= $2::date AND period <= $3::date AND NOT invoiced`,
      [organizationId, periodStart, periodEnd]
    );

    await pool.query('COMMIT');

    // Settle: prefer debiting the prepaid wallet (same mechanism this repo
    // already uses for WhatsApp sends/workflow runs) if the balance covers
    // it; otherwise leave the invoice 'pending' with a Razorpay payment
    // link, same pattern as checkout.js.
    let settlement;
    try {
      // Uses a hand-rolled debit here rather than walletModel.deduct() —
      // deduct() is keyed by actionKey against wallet.credit_rates (a
      // fixed per-unit rate × quantity), which doesn't fit an arbitrary
      // computed invoice total. Same FOR UPDATE row-lock pattern as
      // deduct() to avoid a race against a concurrent recharge/deduction.
      await pool.query('BEGIN');
      const { rows: walletRows } = await pool.query(
        `SELECT * FROM wallets WHERE organization_id = $1 FOR UPDATE`, [organizationId]
      );
      const wallet = walletRows[0];
      if (wallet && Number(wallet.balance) >= totalAmount) {
        const newBalance = Number(wallet.balance) - totalAmount;
        await pool.query(
          `UPDATE wallets SET balance = $2, lifetime_spent = lifetime_spent + $3, updated_at = now()
            WHERE organization_id = $1`,
          [organizationId, newBalance.toFixed(2), totalAmount.toFixed(2)]
        );
        await pool.query(
          `INSERT INTO wallet_transactions (organization_id, type, amount, balance_after, reference_id, description, action_key)
           VALUES ($1,'USAGE_DEDUCTION',$2,$3,$4,$5,'invoice_settlement')`,
          [organizationId, totalAmount.toFixed(2), newBalance.toFixed(2), invoice.id, `Invoice ${invoice.id} settled from wallet`]
        );
        await pool.query(`UPDATE invoices SET status='paid' WHERE id=$1`, [invoice.id]);
        await pool.query('COMMIT');
        settlement = { method: 'wallet', status: 'paid' };
      } else {
        await pool.query('ROLLBACK');
        const rpLink = await razorpay.paymentLink.create({
          amount: toPaise(totalAmount),
          currency: 'INR',
          description: `Invoice ${invoice.id} (${periodStart} to ${periodEnd})`,
          notes: { organization_id: organizationId, invoice_id: invoice.id },
        });
        // payments row purpose=INVOICE_SETTLEMENT + reference_id=invoice.id
        // is what lets webhooks.js's payment_link.paid handler (looking the
        // link up by gateway_order_id) find its way back to this invoice —
        // same reconciliation path WALKIN_SALE already uses.
        await paymentModel.createPayment({
          organizationId,
          purpose: 'INVOICE_SETTLEMENT',
          referenceId: invoice.id,
          amount: totalAmount,
          currency: 'INR',
          method: 'razorpay',
          status: 'pending',
          gateway: 'razorpay',
          gatewayOrderId: rpLink.id,
          notes: { billing_period_start: periodStart, billing_period_end: periodEnd },
        });
        settlement = { method: 'razorpay_payment_link', status: 'pending', paymentLink: rpLink.short_url, keyId: KEY_ID };
      }
    } catch (settleErr) {
      await pool.query('ROLLBACK').catch(() => {});
      console.error('[billing] invoice settlement failed (invoice still recorded as pending):', settleErr.message);
      settlement = { method: 'none', status: 'pending', error: 'Automatic settlement failed — invoice left pending.' };
    }

    res.status(201).json({ invoice, lineItems, settlement });
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    throw e;
  }
});

module.exports = router;
