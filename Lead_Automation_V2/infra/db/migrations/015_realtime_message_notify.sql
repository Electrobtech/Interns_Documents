-- 015_realtime_message_notify.sql
--
-- Adds an AFTER INSERT trigger on `messages` that pg_notify()s a tiny
-- { id, conversation_id, organization_id } payload on every insert,
-- regardless of which service performed it (inbox-service's own reply
-- endpoint, automation-service's messageRepository, or
-- integration-service's conversationStore all write to this same shared
-- table). inbox-service LISTENs on this channel and re-queries the row to
-- broadcast it over Socket.io — see services/inbox-service/src/realtime.js.
--
-- Safe to re-run: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.

CREATE OR REPLACE FUNCTION notify_new_message() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'messages_channel',
    json_build_object(
      'id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'organization_id', NEW.organization_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_notify_trigger ON messages;
CREATE TRIGGER messages_notify_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
