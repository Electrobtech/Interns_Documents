-- =====================================================================
-- 024_billing_payments.sql
--
-- Adds the `payments` table backing billing-service (Razorpay
-- integration): wallet recharges (funds campaigns/broadcasts usage),
-- product-platform checkout, and staff-recorded walk-in sales (cash or
-- a Razorpay Payment Link/QR). Already present in schema.sql for fresh
-- installs — this migration brings existing databases up to date.
-- =====================================================================

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purpose             TEXT NOT NULL CHECK (purpose IN ('WALLET_RECHARGE', 'ECOMMERCE_ORDER', 'WALKIN_SALE')),
  reference_id        UUID,
  contact_id          UUID REFERENCES contacts(id),
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  method              TEXT,
  status              TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'paid', 'failed', 'refunded')),
  gateway             TEXT DEFAULT 'razorpay',
  gateway_order_id    TEXT,
  gateway_payment_id  TEXT,
  gateway_signature   TEXT,
  notes               JSONB,
  created_by_user     UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON payments (gateway_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_gateway_payment_id ON payments (gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

-- Enable + force RLS and add the same tenant_isolation policy every other
-- tenant-scoped table gets (see infra/db/rls.sql for app_current_org() /
-- app_rls_bypass()). Re-running infra/db/rls.sql after this migration also
-- covers it (it now includes 'payments' in its table list) — this block
-- makes the migration correct standalone too, in case rls.sql isn't re-run.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payments;
CREATE POLICY tenant_isolation ON payments
  USING      (app_rls_bypass() OR organization_id = app_current_org())
  WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());
