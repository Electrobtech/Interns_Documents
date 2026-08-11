-- =====================================================================
-- Demo data: extra conversations + messages across all 6 chat-style
-- channels (Instagram, WhatsApp, Messenger, SMS, Voice, Web Chat).
--
-- WHY THIS FILE EXISTS SEPARATELY FROM seed.sql
-- infra/db/seed.sql already seeds one conversation per channel (see its
-- "---------- Conversations + messages ----------" section), but most of
-- those are single-message stubs — enough to prove the schema works, not
-- enough to demo tapping into a thread and seeing a real back-and-forth.
-- This file is purely additive: 2 new contacts + 1 multi-message
-- conversation each, per channel (12 conversations total), so
-- /app/channels/<type> has several rows to click and each one opens a
-- real thread in ActiveChatPanel (see
-- frontend/src/components/channels/ChannelConversationsView.jsx and
-- frontend/src/components/whatsapp/ActiveChatPanel.jsx — tapping a row in
-- the left list is the "click/touch to action" that loads that
-- conversation's messages on the right).
--
-- It does NOT touch schema.sql/rls.sql and is safe to run against an
-- already-running database (unlike seed.sql, which only auto-runs once
-- on a brand-new volume — see infra/db/check-and-reseed.sh). Re-running
-- this file is a no-op the second time (explicit ids + ON CONFLICT DO
-- NOTHING, same convention as seed.sql).
--
-- Targets the same demo org seed.sql creates (Electrobtech Innovations).
-- If you're seeding a different organization, change ORG_ID below (or
-- swap in a WHERE clause on organizations.slug) before running.
--
-- Run it with:
--   docker compose exec -T postgres psql -U lead -d lead_automation \
--     -f /dev/stdin < infra/db/seed-demo-channel-messages.sql
-- or, if the file is already inside the container (e.g. bind-mounted):
--   docker compose exec postgres psql -U lead -d lead_automation \
--     -f /infra/db/seed-demo-channel-messages.sql
-- =====================================================================

-- Make sure all 6 channels show "Connected" for the demo instead of
-- prompting to connect first (sms starts 'disconnected' in seed.sql).
UPDATE channels SET status = 'connected'
 WHERE organization_id = '11111111-1111-1111-1111-111111111111'
   AND type IN ('instagram','whatsapp','messenger','sms','voice','webchat');

-- ---------- Contacts (2 new leads per channel, 12 total) ----------
INSERT INTO contacts (organization_id, name, email, phone, source, external_id, tags) VALUES
  ('11111111-1111-1111-1111-111111111111','Meera Nair','meera.nair@example.com','+919000011101','instagram','919000011101','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Aditya Rao','aditya.rao@example.com','+919000011102','instagram','919000011102','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Sanjay Gupta','sanjay.gupta@example.com','+919000012101','whatsapp','919000012101','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Kavya Iyer','kavya.iyer@example.com','+919000012102','whatsapp','919000012102','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Rahul Bansal','rahul.bansal@example.com','+919000013101','messenger','919000013101','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Divya Reddy','divya.reddy@example.com','+919000013102','messenger','919000013102','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Manoj Tiwari','manoj.tiwari@example.com','+919000014101','sms','919000014101','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Sneha Kapoor','sneha.kapoor@example.com','+919000014102','sms','919000014102','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Arjun Malhotra','arjun.malhotra@example.com','+919000015101','voice','919000015101','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Ritu Chawla','ritu.chawla@example.com','+919000015102','voice','919000015102','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Karthik Subramaniam','karthik.s@example.com','+919000016101','webchat','919000016101','{demo}'),
  ('11111111-1111-1111-1111-111111111111','Isha Bhatt','isha.bhatt@example.com','+919000016102','webchat','919000016102','{demo}')
ON CONFLICT DO NOTHING;

-- ---------- Conversations (1 per contact, 12 total) ----------
-- Explicit ids (d000... range, distinct from seed.sql's c000... range) so
-- the messages insert below can reference them directly. Statuses are
-- deliberately spread across every value the Channels filter dropdown
-- offers (open/pending/handoff/resolved/closed/snoozed) so that filter is
-- demoable too.
INSERT INTO conversations (id, organization_id, contact_id, channel_type, status, last_message_at)
SELECT v.id::uuid, '11111111-1111-1111-1111-111111111111', c.id, v.channel, v.status,
       now() - v.mins * interval '1 minute'
FROM (VALUES
  ('d0000000-0000-0000-0000-000000000001','meera.nair@example.com','instagram','open',3),
  ('d0000000-0000-0000-0000-000000000002','aditya.rao@example.com','instagram','pending',45),
  ('d0000000-0000-0000-0000-000000000003','sanjay.gupta@example.com','whatsapp','resolved',30),
  ('d0000000-0000-0000-0000-000000000004','kavya.iyer@example.com','whatsapp','open',8),
  ('d0000000-0000-0000-0000-000000000005','rahul.bansal@example.com','messenger','handoff',18),
  ('d0000000-0000-0000-0000-000000000006','divya.reddy@example.com','messenger','open',52),
  ('d0000000-0000-0000-0000-000000000007','manoj.tiwari@example.com','sms','closed',200),
  ('d0000000-0000-0000-0000-000000000008','sneha.kapoor@example.com','sms','pending',15),
  ('d0000000-0000-0000-0000-000000000009','arjun.malhotra@example.com','voice','missed',69),
  ('d0000000-0000-0000-0000-000000000010','ritu.chawla@example.com','voice','resolved',94),
  ('d0000000-0000-0000-0000-000000000011','karthik.s@example.com','webchat','open',1),
  ('d0000000-0000-0000-0000-000000000012','isha.bhatt@example.com','webchat','snoozed',130)
) AS v(id, email, channel, status, mins)
JOIN contacts c ON c.email=v.email AND c.organization_id='11111111-1111-1111-1111-111111111111'
ON CONFLICT (id) DO NOTHING;

-- ---------- Messages (multi-turn threads per conversation) ----------
INSERT INTO messages (organization_id, conversation_id, direction, body, sender, created_at)
SELECT '11111111-1111-1111-1111-111111111111', v.cid::uuid, v.dir, v.body, v.sender,
       now() - v.mins * interval '1 minute'
FROM (VALUES
  -- Instagram — Meera Nair (open)
  ('d0000000-0000-0000-0000-000000000001','inbound','Hi! Do you ship to Bangalore?','Meera Nair',12),
  ('d0000000-0000-0000-0000-000000000001','outbound','Yes, we ship pan-India in 3-5 business days!','Agent',10),
  ('d0000000-0000-0000-0000-000000000001','inbound','Great, is the blue one still in stock?','Meera Nair',6),
  ('d0000000-0000-0000-0000-000000000001','outbound','Yes it is! Want me to send the payment link?','Agent',4),
  ('d0000000-0000-0000-0000-000000000001','inbound','Yes please','Meera Nair',3),
  -- Instagram — Aditya Rao (pending)
  ('d0000000-0000-0000-0000-000000000002','inbound','Saw your story — is the discount still on?','Aditya Rao',50),
  ('d0000000-0000-0000-0000-000000000002','outbound','Yes! 15% off ends tonight.','Agent',48),
  ('d0000000-0000-0000-0000-000000000002','inbound','Perfect, placing my order now','Aditya Rao',45),
  -- WhatsApp — Sanjay Gupta (resolved)
  ('d0000000-0000-0000-0000-000000000003','inbound','Hi, I want to reschedule my delivery','Sanjay Gupta',40),
  ('d0000000-0000-0000-0000-000000000003','outbound','Sure, what date works for you?','Agent',38),
  ('d0000000-0000-0000-0000-000000000003','inbound','This Saturday please','Sanjay Gupta',35),
  ('d0000000-0000-0000-0000-000000000003','outbound','Done — rescheduled to Saturday. Anything else?','Agent',32),
  ('d0000000-0000-0000-0000-000000000003','inbound','No that''s all, thanks!','Sanjay Gupta',30),
  -- WhatsApp — Kavya Iyer (open)
  ('d0000000-0000-0000-0000-000000000004','inbound','Is COD available on bulk orders?','Kavya Iyer',8),
  -- Messenger — Rahul Bansal (handoff)
  ('d0000000-0000-0000-0000-000000000005','inbound','I was charged twice for order #4521','Rahul Bansal',25),
  ('d0000000-0000-0000-0000-000000000005','outbound','I''m sorry about that — let me get billing to check.','Agent',22),
  ('d0000000-0000-0000-0000-000000000005','inbound','Please refund the extra charge asap','Rahul Bansal',18),
  -- Messenger — Divya Reddy (open)
  ('d0000000-0000-0000-0000-000000000006','inbound','Do you have a store in Chennai?','Divya Reddy',55),
  ('d0000000-0000-0000-0000-000000000006','outbound','Not yet, but we deliver there in 2 days!','Agent',52),
  -- SMS — Manoj Tiwari (closed)
  ('d0000000-0000-0000-0000-000000000007','outbound','Reminder: your appointment is tomorrow at 4 PM.','System',210),
  ('d0000000-0000-0000-0000-000000000007','inbound','Got it, thanks!','Manoj Tiwari',205),
  ('d0000000-0000-0000-0000-000000000007','outbound','See you then! Reply STOP to opt out.','System',200),
  -- SMS — Sneha Kapoor (pending)
  ('d0000000-0000-0000-0000-000000000008','inbound','Can I get an invoice copy for order #7789?','Sneha Kapoor',15),
  -- Voice — Arjun Malhotra (missed)
  ('d0000000-0000-0000-0000-000000000009','inbound','[Missed voice call — 0:00]','Arjun Malhotra',70),
  ('d0000000-0000-0000-0000-000000000009','outbound','[Voicemail: calling about my refund status]','Arjun Malhotra',69),
  -- Voice — Ritu Chawla (resolved)
  ('d0000000-0000-0000-0000-000000000010','inbound','[Incoming call answered — 3:42]','Ritu Chawla',95),
  ('d0000000-0000-0000-0000-000000000010','outbound','[Call summary: helped track order #3391 — resolved]','Agent',94),
  -- Web Chat — Karthik Subramaniam (open)
  ('d0000000-0000-0000-0000-000000000011','inbound','Hey, are you open right now?','Karthik Subramaniam',5),
  ('d0000000-0000-0000-0000-000000000011','outbound','Yes! We''re online 9am-9pm. How can I help?','Agent',4),
  ('d0000000-0000-0000-0000-000000000011','inbound','Need help choosing a plan','Karthik Subramaniam',2),
  ('d0000000-0000-0000-0000-000000000011','outbound','Sure — what''s your team size?','Agent',1),
  -- Web Chat — Isha Bhatt (snoozed)
  ('d0000000-0000-0000-0000-000000000012','inbound','Will follow up after checking with my manager','Isha Bhatt',130)
) AS v(cid, dir, body, sender, mins);