-- 017_pin_authentication.sql
--
-- Adds PIN-based auth to users: a short numeric PIN as an alternative to
-- the password (see services/auth-service/src/controllers/pinController.js),
-- plus the bookkeeping needed to rate-limit and lock out repeated bad
-- attempts. pin_hash follows the same bcrypt approach as password_hash —
-- never store the PIN itself.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pin_hash             TEXT,
  ADD COLUMN IF NOT EXISTS is_pin_enabled        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_pin_attempts   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_lockout_until     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pin_updated_at        TIMESTAMPTZ;
