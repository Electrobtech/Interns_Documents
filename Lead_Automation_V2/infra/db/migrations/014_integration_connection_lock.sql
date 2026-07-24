-- The Instagram/Facebook (and WhatsApp) "locked connection" feature
-- (services/integration-service/src/services/credentials.js:
-- getConnectionLockState / lockConnection / unlockConnection, and the
-- lock UI in frontend/src/components/ConnectionsPanel.jsx) reads/writes
-- integrations.locked_at and integrations.locked_by, but those columns
-- were never added to the schema — causing every call to
-- GET /auth/connect-url (and /instagram/status, /facebook/status,
-- /whatsapp/status) to 500 with "column \"locked_at\" does not exist".

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON DELETE SET NULL;