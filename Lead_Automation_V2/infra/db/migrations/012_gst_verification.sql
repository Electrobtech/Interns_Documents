-- 012_gst_verification.sql
--
-- Backs the "Verify GST" flow added to Step 5 of the registration wizard
-- (services/auth-service/src/controllers/gstController.js). Adds the extra
-- organization columns GST auto-fill populates, plus a small cache table so
-- repeated lookups of the same GSTIN don't re-hit the metered RapidAPI call.
--
-- NOTE: infra/db/schema.sql has already been updated with these same
-- changes for fresh installs. Run this file by hand against any database
-- that was already initialized before this change:
--   psql "$DATABASE_URL" -f infra/db/migrations/012_gst_verification.sql

-- ---------- organizations: GST-derived fields ----------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trade_name           TEXT,
  ADD COLUMN IF NOT EXISTS district             TEXT,
  ADD COLUMN IF NOT EXISTS gst_status           TEXT,   -- e.g. Active | Cancelled | Suspended, as returned by the GST provider
  ADD COLUMN IF NOT EXISTS gst_registration_date TEXT,   -- kept as returned by the provider (formats vary); not a DB date type
  ADD COLUMN IF NOT EXISTS gst_verified_at       TIMESTAMPTZ;

-- ---------- GST verification cache ----------
-- Minimal, non-sensitive fields only (see gstService.js) — never the raw
-- RapidAPI payload or credentials. Reused across registrations/orgs so we
-- don't re-call the external API for a GSTIN we've already verified
-- recently (see GST_CACHE_TTL_DAYS in gstService.js).
CREATE TABLE IF NOT EXISTS gst_verifications (
  gst_number            TEXT PRIMARY KEY,
  verification_status   TEXT,
  company_name           TEXT,
  trade_name             TEXT,
  business_type          TEXT,   -- constitution of business, as returned by the provider (free text)
  registration_date      TEXT,
  address                 TEXT,
  district                TEXT,
  state                   TEXT,
  pincode                 TEXT,
  verified_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);