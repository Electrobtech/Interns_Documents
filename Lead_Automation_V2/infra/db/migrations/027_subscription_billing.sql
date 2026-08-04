-- =====================================================================
-- 027_subscription_billing.sql
--
-- Super Admin "Module 2" — Subscriptions, Invoicing & GST Billing.
--
-- SCOPE NOTE: `subscriptions` and `invoices` already exist as bare stub
-- tables in schema.sql (organization_id/plan/status and
-- organization_id/amount/status respectively) — `subscriptions` already
-- gets one row per org at registration (see companyController.js), but
-- nothing populates or reads `invoices` yet. This migration extends both
-- in place (ALTER, not DROP/CREATE) rather than replacing them, so the
-- existing registration INSERT keeps working unmodified.
--
-- ONE ROW PER ORG in `subscriptions`, same convention as `wallets`: plan
-- changes are UPDATEs to the org's single row, not a new historical row.
-- (There is currently no unique constraint enforcing this — only one
-- INSERT call site exists today — so this migration adds one.)
--
-- WHY invoices GAINS SELLER/BUYER GST FIELDS RATHER THAN JOINING OUT TO
-- organizations AT READ TIME: a GST invoice is a legal document — its
-- CGST/SGST/IGST split and the buyer's name/GSTIN must reflect what was
-- true *at the moment it was issued*, not whatever the tenant's profile
-- says today (they might change their registered state next month).
-- Snapshotting onto the invoice row is standard invoicing practice, not
-- an oversight.
-- =====================================================================

-- ---------- subscriptions: real lifecycle + billing fields ----------
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle         TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS amount                NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency              TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS auto_billing          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_period_start  DATE NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS current_period_end    DATE,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by_admin      UUID REFERENCES platform_admins(id),
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill current_period_end for the bare rows registration already
-- created (billing_cycle just defaulted to 'monthly' above for them).
UPDATE subscriptions
   SET current_period_end = current_period_start + INTERVAL '1 month'
 WHERE current_period_end IS NULL;

ALTER TABLE subscriptions
  ALTER COLUMN current_period_end SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_billing_cycle_check
    CHECK (billing_cycle IN ('monthly', 'yearly'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One current subscription row per org (see header note).
-- NOTE: a UNIQUE constraint's backing index collision raises
-- duplicate_table (42P07), not duplicate_object (42710) like a repeated
-- CHECK constraint name does — caught the wrong one on the first pass of
-- this migration and it broke re-running against an already-migrated
-- database (verified against a real Postgres instance; see git history /
-- PR notes for the failing run this fixes).
DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

-- ---------- invoices: full GST invoice model ----------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number      TEXT,
  ADD COLUMN IF NOT EXISTS subscription_id     UUID REFERENCES subscriptions(id),
  ADD COLUMN IF NOT EXISTS payment_id          UUID REFERENCES payments(id),
  -- Seller = the platform itself (one legal entity, so no FK — see
  -- shared/src/models/invoiceModel.js's PLATFORM_GST_PROFILE).
  ADD COLUMN IF NOT EXISTS seller_gstin        TEXT,
  ADD COLUMN IF NOT EXISTS seller_state_code   TEXT,
  -- Buyer = the tenant organization, snapshotted at issue time.
  ADD COLUMN IF NOT EXISTS buyer_legal_name    TEXT,
  ADD COLUMN IF NOT EXISTS buyer_gstin         TEXT,
  ADD COLUMN IF NOT EXISTS buyer_state         TEXT,
  ADD COLUMN IF NOT EXISTS buyer_state_code    TEXT,
  ADD COLUMN IF NOT EXISTS place_of_supply     TEXT,
  ADD COLUMN IF NOT EXISTS hsn_sac_code        TEXT DEFAULT '998314', -- "Information technology (IT) support services"
  ADD COLUMN IF NOT EXISTS line_items          JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tax           NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency            TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS due_date            DATE,
  ADD COLUMN IF NOT EXISTS issued_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_url             TEXT,
  ADD COLUMN IF NOT EXISTS pdf_generated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_by_admin  UUID REFERENCES platform_admins(id),
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT now();

-- `amount` already existed (bare NUMERIC, nullable) — this is the grand
-- total (subtotal + total_tax). Give it the NOT NULL + default the rest
-- of the row now has; existing rows (there are none live yet — grepped,
-- nothing inserts into invoices today) get 0.
UPDATE invoices SET amount = 0 WHERE amount IS NULL;
ALTER TABLE invoices ALTER COLUMN amount SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN amount SET DEFAULT 0;

UPDATE invoices SET status = 'draft' WHERE status IS NULL;
ALTER TABLE invoices ALTER COLUMN status SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN status SET DEFAULT 'draft';

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'issued', 'paid', 'void'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_org_created ON invoices (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices (subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices (payment_id);

-- ---------- Sequential, gapless-per-FY invoice numbering ----------
-- Indian GST invoices must be numbered sequentially (no gaps) within a
-- financial year (Apr–Mar). One row per FY, atomically incremented via
-- the UPSERT in invoiceModel.js#nextInvoiceNumber() (a single
-- INSERT..ON CONFLICT..RETURNING is atomic under Postgres's MVCC without
-- needing an explicit transaction/row-lock dance, unlike walletModel's
-- balance updates which genuinely need SELECT..FOR UPDATE).
CREATE TABLE IF NOT EXISTS invoice_counters (
  financial_year TEXT PRIMARY KEY, -- e.g. '2026-27'
  last_number    INT NOT NULL DEFAULT 0
);

-- ---------- payments: add a purpose for subscription billing ----------
-- Existing purposes (WALLET_RECHARGE / ECOMMERCE_ORDER / WALKIN_SALE) are
-- all tenant-initiated top-ups/sales; SUBSCRIPTION_CHARGE is the platform
-- billing the tenant for their plan (recurring or one-off invoice), which
-- didn't previously exist as a payment "reason".
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('WALLET_RECHARGE', 'ECOMMERCE_ORDER', 'WALKIN_SALE', 'SUBSCRIPTION_CHARGE'));

-- RLS: invoices/subscriptions/invoice_counters — invoices and
-- subscriptions are already in rls.sql's tenant-scoped loop (both carry
-- organization_id and were already governed, just with fewer columns).
-- invoice_counters carries no organization_id (numbering is platform-
-- wide, not per-tenant) — same shape as platform_admins, so it's excluded
-- from the loop and locked down to Super Admin only.
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bypass_only ON invoice_counters;
CREATE POLICY bypass_only ON invoice_counters USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
