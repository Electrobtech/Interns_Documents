-- 016_contact_opt_out.sql
--
-- Adds persistent opt-out tracking to contacts, so a STOP/UNSUBSCRIBE
-- keyword actually blocks future automated + campaign sends to that
-- contact, instead of only routing the current turn to an "unsubscribe"
-- playbook (which sends one confirmation and does nothing to stop the
-- NEXT message). See services/automation-service/src/services/complianceGuard.js.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS opted_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;
