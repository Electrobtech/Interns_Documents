-- 005_google_oauth_config.sql
--
-- Lets each organization (tenant) configure its own Google OAuth Client ID
-- / Client Secret for the Google Business Profile Reviews integration,
-- instead of sharing the single GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
-- pair from the backend .env. See services/review-service/src/google/configStore.js.
--
-- NOTE: infra/db/schema.sql has already been updated with this same table
-- for fresh installs (docker-entrypoint-initdb.d only runs against an empty
-- Postgres volume). Run this file by hand against any database that was
-- already initialized before this change:
--   psql "$DATABASE_URL" -f infra/db/migrations/005_google_oauth_config.sql

-- One Google OAuth client configuration per organization. The client secret
-- is stored encrypted (AES-256-GCM) when GOOGLE_TOKEN_ENC_KEY is set — see
-- services/review-service/src/google/crypto.js (same helper used for
-- google_tokens.refresh_token).
CREATE TABLE IF NOT EXISTS google_oauth_configs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id               TEXT NOT NULL,
  encrypted_client_secret TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);
