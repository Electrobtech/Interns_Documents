-- 004_google_reviews.sql
--
-- Adds Google Business Profile Reviews integration tables, scoped by
-- organization_id like every other table in this schema.
--
-- NOTE: infra/db/schema.sql has already been updated with these same
-- tables for fresh installs (docker-entrypoint-initdb.d only runs against
-- an empty Postgres volume). Run this file by hand against any database
-- that was already initialized before this change:
--   psql "$DATABASE_URL" -f infra/db/migrations/004_google_reviews.sql

-- One connected Google account per organization. refresh_token is stored
-- encrypted (AES-256-GCM) when GOOGLE_TOKEN_ENC_KEY is set — see
-- services/review-service/src/google/crypto.js.
CREATE TABLE IF NOT EXISTS google_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  access_token      TEXT,
  access_expires_at TIMESTAMPTZ,
  refresh_token     TEXT NOT NULL,
  scope             TEXT,
  connected_by      UUID REFERENCES users(id),
  last_sync_at      TIMESTAMPTZ,
  last_sync_status  TEXT,                 -- ok | error
  last_sync_error   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS google_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL,        -- Google resource name suffix, e.g. "accounts/123"
  account_name      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, account_id)
);

CREATE TABLE IF NOT EXISTS google_locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL,
  location_id       TEXT NOT NULL,        -- Google resource name suffix, e.g. "locations/456"
  location_name     TEXT,
  address           TEXT,
  phone             TEXT,
  is_selected       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, location_id)
);

CREATE TABLE IF NOT EXISTS google_reviews (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  location_id        TEXT NOT NULL,
  review_id          TEXT NOT NULL,       -- Google review resource name suffix
  reviewer_name       TEXT,
  reviewer_photo_url  TEXT,
  star_rating         INT,
  comment             TEXT,
  create_time         TIMESTAMPTZ,
  update_time         TIMESTAMPTZ,
  reply_comment        TEXT,
  reply_update_time    TIMESTAMPTZ,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_google_reviews_org_location
  ON google_reviews (organization_id, location_id);

CREATE INDEX IF NOT EXISTS idx_google_reviews_org_created
  ON google_reviews (organization_id, create_time DESC);
