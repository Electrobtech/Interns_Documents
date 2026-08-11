-- infra/db/migrations/034_finance_accounting.sql
--
-- Finances & Accounting module (/app/finances) — the tenant's OWN business
-- ledger (course revenue + operating expenses), deliberately separate from
-- the existing `invoices`/`invoice_counters` tables in 027_subscription_billing.sql,
-- which record the PLATFORM billing a tenant for its SaaS subscription.
-- Same GST mechanics (CGST/SGST vs IGST, gapless per-FY invoice numbers),
-- different direction of money: here the tenant is the SELLER, invoicing
-- their own students, not the buyer of a platform invoice. See
-- shared/src/models/invoiceModel.js's header comment for the GST mechanics
-- this mirrors.
--
-- Run by hand against an already-initialized DB:
--   psql "$DATABASE_URL" -f infra/db/migrations/034_finance_accounting.sql

-- ---------- finance_transactions ----------
-- Unified INCOME/EXPENSE ledger. A course-enrollment INCOME row is created
-- by finance-service's course-invoice endpoint (one row per invoice); an
-- EXPENSE row is created directly from the Expenses & Outgoings tab (or by
-- the Sales Agent's recordExpense tool).
CREATE TABLE IF NOT EXISTS finance_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  -- Free-form but UI-constrained category. Expenses: SALARY, UTILITIES,
  -- TAXES, VENDOR, SOFTWARE, RENT, OTHER. Income: COURSE_ENROLLMENT, OTHER.
  category          TEXT NOT NULL,
  amount            NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency          TEXT NOT NULL DEFAULT 'INR',
  payment_method    TEXT,              -- cash | bank_transfer | upi | card | cheque | wallet | other
  reference_id      TEXT,              -- external ref: bank UTR, cheque no., vendor invoice no.
  description       TEXT,
  tds_notes         TEXT,              -- free-text TDS/tax note (e.g. "TDS 10% u/s 194J deducted")
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Set when this INCOME row was generated from a course_invoices row —
  -- lets the Overview/Invoices tab join back to the statutory PDF.
  invoice_id        UUID,
  -- Distinguishes a human-entered row from one written by the AI Sales
  -- Agent's recordExpense/generateCourseInvoice tool, for audit purposes.
  source            TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_agent')),
  created_by_user   UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_org_date
  ON finance_transactions (organization_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_org_type
  ON finance_transactions (organization_id, type);

-- ---------- course_invoices ----------
-- Statutory GST invoice rows for course/service sales (SAC 9992 —
-- "Education services"). One row per invoice; `finance_transactions.invoice_id`
-- points back here for the matching INCOME row.
CREATE TABLE IF NOT EXISTS course_invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number        TEXT NOT NULL,   -- e.g. FY26-27/INV-0102 — gapless per org+FY, assigned at issue time
  financial_year        TEXT NOT NULL,   -- e.g. '2026-27'

  -- Seller = the tenant org itself (snapshotted at issue time so a later
  -- edit to the org's GST profile never rewrites a historical invoice —
  -- same rationale as invoiceModel.js's buyer/seller snapshot).
  seller_legal_name     TEXT NOT NULL,
  seller_gstin          TEXT,
  seller_address        TEXT,
  seller_state          TEXT,
  seller_state_code     TEXT,

  -- Buyer = the student. No GSTIN expected in the common case (B2C) but
  -- the column exists for institutional/corporate-sponsored enrollments.
  student_name          TEXT NOT NULL,
  student_gstin         TEXT,
  student_address       TEXT,
  student_state         TEXT NOT NULL,
  student_state_code    TEXT NOT NULL,
  place_of_supply       TEXT NOT NULL,

  sac_code              TEXT NOT NULL DEFAULT '9992',
  course_name           TEXT,

  base_amount           NUMERIC(12,2) NOT NULL,   -- extracted from the GST-inclusive price
  gst_rate              NUMERIC(5,2)  NOT NULL DEFAULT 18,
  cgst_rate             NUMERIC(5,2)  NOT NULL DEFAULT 0,
  cgst_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_rate             NUMERIC(5,2)  NOT NULL DEFAULT 0,
  sgst_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_rate             NUMERIC(5,2)  NOT NULL DEFAULT 0,
  igst_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  intra_state           BOOLEAN NOT NULL,
  total_amount          NUMERIC(12,2) NOT NULL,

  status                TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'void')),
  pdf_generated_at      TIMESTAMPTZ,
  source                TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_agent')),
  created_by_user       UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_course_invoices_org_created
  ON course_invoices (organization_id, created_at DESC);

-- ---------- finance_invoice_counters ----------
-- Gapless per-(org, financial-year) invoice number sequence — same UPSERT
-- pattern as invoiceModel.js's `invoice_counters`, but keyed per org too
-- since here EVERY tenant issues its own invoice series (not just the
-- platform issuing one global series).
CREATE TABLE IF NOT EXISTS finance_invoice_counters (
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  financial_year    TEXT NOT NULL,
  last_number       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, financial_year)
);

-- ---------- RLS ----------
-- Adds the three tables above to the standard organization_id-scoped policy
-- loop in infra/db/rls.sql. Also runnable standalone against an
-- already-initialized DB (mirrors that file's DO block exactly).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['finance_transactions', 'course_invoices', 'finance_invoice_counters']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING      (app_rls_bypass() OR organization_id = app_current_org())
         WITH CHECK (app_rls_bypass() OR organization_id = app_current_org())',
      t
    );
  END LOOP;
END $$;
