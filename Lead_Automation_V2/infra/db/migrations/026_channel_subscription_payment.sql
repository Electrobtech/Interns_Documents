-- =====================================================================
-- 026_channel_subscription_payment.sql
--
-- Wires channel subscriptions up to a real charge, using the same
-- Razorpay order -> Checkout.js -> verify/webhook pattern wallet
-- recharge already uses (see wallet.js / webhooks.js). A newly-toggled-on
-- channel now sits as 'pending_payment' until the charge actually clears,
-- instead of going straight to 'active' for free.
-- =====================================================================

ALTER TABLE organization_channel_subscriptions DROP CONSTRAINT IF EXISTS organization_channel_subscriptions_status_check;
ALTER TABLE organization_channel_subscriptions ADD CONSTRAINT organization_channel_subscriptions_status_check
  CHECK (status IN ('pending_payment','active','paused','cancelled'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('WALLET_RECHARGE', 'ECOMMERCE_ORDER', 'WALKIN_SALE', 'INVOICE_SETTLEMENT', 'CHANNEL_SUBSCRIPTION'));

-- ux_org_channel_sub_live's predicate needs to include the new
-- 'pending_payment' status too (a pending-payment row is still "live" and
-- should block a duplicate subscribe attempt) — a partial index's WHERE
-- clause can't be ALTERed, so drop and recreate.
DROP INDEX IF EXISTS ux_org_channel_sub_live;
CREATE UNIQUE INDEX ux_org_channel_sub_live
  ON organization_channel_subscriptions (organization_id, channel_type)
  WHERE status IN ('pending_payment','active','paused');
