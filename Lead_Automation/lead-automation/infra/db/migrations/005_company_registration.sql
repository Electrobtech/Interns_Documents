-- 005_company_registration.sql
--
-- Adds the fields/tables needed by the Company Registration (Tenant
-- Onboarding) wizard. "Tenant" in the product spec == the existing
-- `organizations` table; we extend it rather than adding a parallel model,
-- since every other table already scopes itself by organization_id.
--
-- NOTE: infra/db/schema.sql has already been updated with these same
-- changes for fresh installs (docker-entrypoint-initdb.d only runs against
-- an empty Postgres volume). Run this file by hand against any database
-- that was already initialized before this change:
--   psql "$DATABASE_URL" -f infra/db/migrations/005_company_registration.sql

-- ---------- organizations (Tenant) profile fields ----------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS legal_name             TEXT,
  ADD COLUMN IF NOT EXISTS business_type           TEXT,   -- proprietorship | partnership | llp | private_limited | public_limited | startup | ngo | other
  ADD COLUMN IF NOT EXISTS industry                TEXT,
  ADD COLUMN IF NOT EXISTS website                 TEXT,
  ADD COLUMN IF NOT EXISTS logo_url                TEXT,
  ADD COLUMN IF NOT EXISTS employee_count          TEXT,
  ADD COLUMN IF NOT EXISTS description             TEXT,
  ADD COLUMN IF NOT EXISTS company_email           TEXT,
  ADD COLUMN IF NOT EXISTS company_phone           TEXT,
  ADD COLUMN IF NOT EXISTS support_email           TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone         TEXT,
  ADD COLUMN IF NOT EXISTS address_line1           TEXT,
  ADD COLUMN IF NOT EXISTS address_line2           TEXT,
  ADD COLUMN IF NOT EXISTS city                    TEXT,
  ADD COLUMN IF NOT EXISTS state                   TEXT,
  ADD COLUMN IF NOT EXISTS country                 TEXT,
  ADD COLUMN IF NOT EXISTS postal_code             TEXT,
  ADD COLUMN IF NOT EXISTS gst_number              TEXT,
  ADD COLUMN IF NOT EXISTS pan_number              TEXT,
  ADD COLUMN IF NOT EXISTS registration_number     TEXT,
  ADD COLUMN IF NOT EXISTS incorporation_cert_url  TEXT,
  ADD COLUMN IF NOT EXISTS gst_cert_url            TEXT,
  ADD COLUMN IF NOT EXISTS registration_cert_url   TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan       TEXT DEFAULT 'starter', -- starter | professional | enterprise
  ADD COLUMN IF NOT EXISTS coupon_code             TEXT,
  ADD COLUMN IF NOT EXISTS status                  TEXT DEFAULT 'pending', -- pending | active | suspended
  ADD COLUMN IF NOT EXISTS onboarding_step         INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ NOT NULL DEFAULT now();

-- Case-insensitive duplicate-company check (Step 2 validation).
CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_ci_idx ON organizations (lower(name));

-- ---------- users (Account Owner) fields ----------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mobile               TEXT,
  ADD COLUMN IF NOT EXISTS is_email_verified    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_phone_verified    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_method    TEXT; -- authenticator | sms

-- ---------- Roles ----------
-- Existing roles are admin | manager | agent. The wizard's Account Owner
-- becomes 'owner' (full tenant control); 'viewer' is read-only.
INSERT INTO roles (name, description) VALUES
  ('owner',  'Tenant owner — full access, billing, and org settings'),
  ('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- ---------- Verification codes (Step 1 2FA + Step 5 verification) ----------
-- organization_id is nullable because email/mobile verification can happen
-- mid-wizard, before the tenant row exists yet.
CREATE TABLE IF NOT EXISTS verification_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,           -- email | mobile
  target          TEXT NOT NULL,           -- the email address or phone number
  code_hash       TEXT NOT NULL,
  purpose         TEXT NOT NULL DEFAULT 'signup',
  consumed        BOOLEAN NOT NULL DEFAULT false,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_codes_target_idx ON verification_codes (channel, target);
