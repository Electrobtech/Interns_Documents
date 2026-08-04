-- =====================================================================
-- 027_subscription_plan_payment.sql
--
-- Wires the registration wizard's Step 7 "Subscription" plan up to a real
-- charge, the same order -> Checkout.js -> verify/webhook pattern already
-- used for wallet recharge and channel subscriptions (see
-- services/billing-service/src/routes/channels.js and
-- infra/db/migrations/026_channel_subscription_payment.sql).
--
-- A newly-registered company on a paid plan (starter/professional) now
-- gets its `subscriptions` row created as 'pending_payment' instead of
-- 'active' — it only flips to 'active' once Razorpay actually confirms
-- the charge. Enterprise ("Custom" pricing, sales-quoted) keeps going
-- straight to 'active', since there is no fixed amount to charge inline.
-- =====================================================================

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('WALLET_RECHARGE', 'ECOMMERCE_ORDER', 'WALKIN_SALE', 'INVOICE_SETTLEMENT', 'CHANNEL_SUBSCRIPTION', 'SUBSCRIPTION'));

-- subscriptions.status was never constrained (plain TEXT DEFAULT 'active'),
-- so 'pending_payment' needs no DDL change to be insertable — this ALTER
-- just documents the now-valid values explicitly, matching the pattern
-- organization_channel_subscriptions already uses.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending_payment', 'active', 'past_due', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_status
  ON subscriptions (organization_id, status);
