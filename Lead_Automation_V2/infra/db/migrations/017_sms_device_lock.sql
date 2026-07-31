-- Extends the same "locked connection" pattern used for Instagram/Facebook/
-- WhatsApp (see 014_integration_connection_lock.sql) to SMS devices: once a
-- phone is connected, it's locked automatically so it can't be edited,
-- re-tokened, or removed by accident — only an org admin, with the admin
-- unlock password, can unlock it first. See
-- services/integration-service/src/routes/smsDevices.js.

ALTER TABLE sms_devices
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON DELETE SET NULL;