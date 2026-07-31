-- 021_campaign_recipient_message.sql
--
-- campaign_recipients (020_bulk_campaigns.sql) tracked send status/error per
-- row, but not the actual message text that was sent — fine while every
-- recipient's message was identical, but a broadcast can carry the same
-- phone number twice (a duplicate row in an uploaded CSV, or the same
-- number manually entered under two different sets of {{variables}} to
-- compare renders) with genuinely different resolved text each time. Status
-- alone can't distinguish those rows in the Bulk Campaign tab's diagnostics
-- panel; the rendered message itself needs to live on the row.

ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS rendered_message TEXT;
