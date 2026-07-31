-- =====================================================================
-- 021_super_admin_billing.sql
--
-- Adds the Platform Super Admin layer on top of the existing multi-
-- tenant schema: a prepaid wallet/ledger per organization, feature
-- flags, and a platform_admins table for staff who are NOT scoped to
-- any single tenant (unlike every other user in this system).
--
-- NOTE ON SCOPE: `organizations`, `users`, and `leads` already exist
-- (see schema.sql) and already cover "companies", "users", and "leads"
-- — this migration does not recreate them, only adds what's missing
-- for billing/admin. `audit_logs` also already exists (shared/src/audit.js)
-- and is reused as-is for super-admin action logging.
-- =====================================================================

-- ---------- Platform staff (NOT tenant-scoped) ----------
-- Deliberately separate from `users`, which always carries an
-- organization_id and is governed by the roles/permissions RBAC used
-- inside a tenant. A super admin isn't "inside" any tenant, so giving
-- them a users row with organization_id = NULL would either break the
-- NOT NULL-ish assumptions elsewhere or require special-casing RLS for
-- a single row type. A dedicated table keeps that boundary explicit.
CREATE TABLE IF NOT EXISTS platform_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active', -- active | disabled
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Prepaid wallet (one row per tenant) ----------
CREATE TABLE IF NOT EXISTS wallets (
  organization_id       UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  balance               NUMERIC(14,2) NOT NULL DEFAULT 0,
  lifetime_deposited    NUMERIC(14,2) NOT NULL DEFAULT 0,
  lifetime_spent        NUMERIC(14,2) NOT NULL DEFAULT 0,
  low_balance_threshold NUMERIC(14,2) NOT NULL DEFAULT 100,
  -- Per-action credit rates, e.g. {"whatsapp_message": 1, "workflow_execution": 1}.
  -- JSONB so new billable actions don't need a migration each time.
  credit_rates          JSONB NOT NULL DEFAULT '{"whatsapp_message": 1, "workflow_execution": 1}'::jsonb,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Wallet ledger (append-only, one row per movement) ----------
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('RECHARGE', 'USAGE_DEDUCTION', 'ADJUSTMENT')),
  amount            NUMERIC(14,2) NOT NULL,       -- always positive; `type` gives direction
  balance_after     NUMERIC(14,2) NOT NULL,       -- wallet balance immediately after this row
  reference_id      TEXT,                         -- e.g. payment gateway ref, message id, workflow run id
  description       TEXT,
  action_key        TEXT,                         -- e.g. 'whatsapp_message' — which credit_rates entry, if a USAGE_DEDUCTION
  created_by_user   UUID REFERENCES users(id),          -- tenant user/agent whose action triggered a deduction
  created_by_admin  UUID REFERENCES platform_admins(id), -- platform admin, for manual RECHARGE/ADJUSTMENT
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_org_created ON wallet_transactions (organization_id, created_at DESC);

-- ---------- Feature flags (per-tenant module toggles) ----------
CREATE TABLE IF NOT EXISTS feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key        TEXT NOT NULL,   -- e.g. 'ai_auto_responder'
  enabled         BOOLEAN NOT NULL DEFAULT false,
  updated_by_admin UUID REFERENCES platform_admins(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, flag_key)
);

-- ---------- Media / image attachments ----------
-- Kept in Postgres rather than introducing MongoDB: nothing else in
-- this repo touches Mongo (grepped the whole tree — zero hits), file
-- bytes already live outside the DB (multer + a URL column, same as
-- organizations.logo_url), and this table only needs to store that URL
-- plus ownership/metadata — a document store would add an entire new
-- piece of infrastructure for no structural benefit here. If a real
-- need for schema-flexible document storage shows up later (e.g. rich
-- per-message provider payloads), it's worth a dedicated discussion
-- rather than folding it into the billing migration.
CREATE TABLE IF NOT EXISTS attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_type      TEXT NOT NULL,   -- 'lead' | 'contact' | 'message' | 'company'
  owner_id        UUID NOT NULL,
  file_url        TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      INT,
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments (organization_id, owner_type, owner_id);

-- Auto-provision a wallet row whenever a new organization is created,
-- so callers never have to remember a separate "create wallet" step.
CREATE OR REPLACE FUNCTION create_wallet_for_new_org() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (organization_id) VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_wallet_for_new_org ON organizations;
CREATE TRIGGER trg_create_wallet_for_new_org
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_wallet_for_new_org();

-- Backfill wallets for any organizations that already existed before this migration.
INSERT INTO wallets (organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
