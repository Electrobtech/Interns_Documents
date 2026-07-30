-- 018_pin_expiration_history.sql
--
-- Supports two additions to PIN login (services/auth-service/src/controllers/pinController.js):
--   1. 30-day PIN expiration — reuses the existing pin_updated_at column from
--      017_pin_authentication.sql; no new column needed, the age check is
--      computed at verify-pin time rather than stored, so it can't go stale.
--   2. PIN history — previous_pin_hash holds the bcrypt hash of the PIN that
--      was just replaced, so setup-pin / reset-pin-request can reject a new
--      PIN that matches either the current or the immediately-prior one.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS previous_pin_hash TEXT;