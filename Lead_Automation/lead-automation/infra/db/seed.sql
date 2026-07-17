-- =====================================================================
-- Seed data for Lead Automation (org: Electrobtech Innovations)
-- Login: admin@electrobtech.com / Admin@123
-- Safe to run on a fresh database (created by scripts/setup-db.sh / compose).
-- =====================================================================

INSERT INTO roles (name, description) VALUES
  ('admin',   'Full access'),
  ('manager', 'Manage team and campaigns'),
  ('agent',   'Handle conversations')
ON CONFLICT (name) DO NOTHING;

INSERT INTO organizations (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Electrobtech Innovations', 'electrobtech')
ON CONFLICT (slug) DO NOTHING;

-- ---------- Users (all demo passwords are Admin@123) ----------
INSERT INTO users (organization_id, role_id, name, email, password_hash, availability)
SELECT '11111111-1111-1111-1111-111111111111', (SELECT id FROM roles WHERE name=r.role),
       r.name, r.email, '$2b$10$vg0wERwhYziH8IvNSL.0nOq1wyeByQqhTkd.1H/oSDIVLPyErkG9m', r.av
FROM (VALUES
  ('admin',   'Arjun Kumar',  'admin@electrobtech.com', 'online'),
  ('manager', 'Priya Sharma', 'priya@electrobtech.com', 'online'),
  ('agent',   'Karan Mehta',  'karan@electrobtech.com', 'away')
) AS r(role, name, email, av)
ON CONFLICT (organization_id, email) DO NOTHING;

INSERT INTO teams (organization_id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Support'),
  ('11111111-1111-1111-1111-111111111111', 'Sales')
ON CONFLICT DO NOTHING;

-- ---------- Channels ----------
INSERT INTO channels (organization_id, type, display_name, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'whatsapp',  'WhatsApp Business', 'connected'),
  ('11111111-1111-1111-1111-111111111111', 'instagram', 'Instagram DM',      'connected'),
  ('11111111-1111-1111-1111-111111111111', 'messenger', 'Facebook Messenger','connected'),
  ('11111111-1111-1111-1111-111111111111', 'webchat',   'Website Chat',      'connected'),
  ('11111111-1111-1111-1111-111111111111', 'sms',       'SMS / RCS',         'disconnected'),
  ('11111111-1111-1111-1111-111111111111', 'voice',     'Voice Call',        'connected'),
  ('11111111-1111-1111-1111-111111111111', 'email',     'Email Inbox',       'disconnected')
ON CONFLICT DO NOTHING;

-- ---------- Integrations ----------
INSERT INTO integrations (organization_id, provider, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'shopify',       'connected'),
  ('11111111-1111-1111-1111-111111111111', 'stripe',        'connected'),
  ('11111111-1111-1111-1111-111111111111', 'google_sheets', 'disconnected'),
  ('11111111-1111-1111-1111-111111111111', 'zapier',        'disconnected')
ON CONFLICT DO NOTHING;

-- ---------- AI Agents ----------
INSERT INTO ai_agents (organization_id, name, type, status, config) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Support Agent',   'support',   'active', '{"tone":"friendly"}'),
  ('11111111-1111-1111-1111-111111111111', 'Sales Agent',     'sales',     'active', '{"tone":"persuasive"}'),
  ('11111111-1111-1111-1111-111111111111', 'Marketing Agent', 'marketing', 'active', '{"tone":"upbeat"}'),
  ('11111111-1111-1111-1111-111111111111', 'Voice Agent',     'voice',     'active', '{"tone":"calm"}')
ON CONFLICT DO NOTHING;

-- ---------- Contacts ----------
INSERT INTO contacts (organization_id, name, email, phone, source, tags) VALUES
  ('11111111-1111-1111-1111-111111111111','Rohan Verma','rohan@example.com','+919000000001','whatsapp','{vip}'),
  ('11111111-1111-1111-1111-111111111111','Ananya Singh','ananya@example.com','+919000000002','instagram','{}'),
  ('11111111-1111-1111-1111-111111111111','Neha Patel','neha@example.com','+919000000003','webchat','{}'),
  ('11111111-1111-1111-1111-111111111111','Vikram Joshi','vikram@example.com','+919000000004','messenger','{}'),
  ('11111111-1111-1111-1111-111111111111','Pooja Mehta','pooja@example.com','+919000000005','sms','{}'),
  ('11111111-1111-1111-1111-111111111111','Amit Kumar','amit@example.com','+919000000006','voice','{}')
ON CONFLICT DO NOTHING;

-- ---------- Leads ----------
INSERT INTO leads (organization_id, contact_id, stage, priority, score)
SELECT '11111111-1111-1111-1111-111111111111', c.id, v.stage, v.priority, v.score
FROM (VALUES
  ('rohan@example.com','active','high',82),
  ('ananya@example.com','qualified','medium',60),
  ('neha@example.com','new','low',35),
  ('vikram@example.com','won','high',95)
) AS v(email, stage, priority, score)
JOIN contacts c ON c.email=v.email AND c.organization_id='11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- ---------- Conversations + messages ----------
-- Each conversation gets an explicit id so its messages can reference it.
INSERT INTO conversations (id, organization_id, contact_id, channel_type, status, last_message_at)
SELECT v.id::uuid, '11111111-1111-1111-1111-111111111111', c.id, v.channel, v.status,
       now() - v.mins * interval '1 minute'
FROM (VALUES
  ('c0000000-0000-0000-0000-000000000001','rohan@example.com','whatsapp','open',2),
  ('c0000000-0000-0000-0000-000000000002','ananya@example.com','instagram','open',5),
  ('c0000000-0000-0000-0000-000000000003','neha@example.com','webchat','pending',10),
  ('c0000000-0000-0000-0000-000000000004','vikram@example.com','messenger','open',15),
  ('c0000000-0000-0000-0000-000000000005','pooja@example.com','sms','campaign',20),
  ('c0000000-0000-0000-0000-000000000006','amit@example.com','voice','missed',25),
  ('c0000000-0000-0000-0000-000000000007','rohan@example.com','whatsapp','open',40),
  ('c0000000-0000-0000-0000-000000000008','ananya@example.com','instagram','closed',120),
  ('c0000000-0000-0000-0000-000000000009','neha@example.com','whatsapp','open',180)
) AS v(id, email, channel, status, mins)
JOIN contacts c ON c.email=v.email AND c.organization_id='11111111-1111-1111-1111-111111111111'
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (organization_id, conversation_id, direction, body, sender, created_at)
SELECT '11111111-1111-1111-1111-111111111111', v.cid::uuid, v.dir, v.body, v.sender,
       now() - v.mins * interval '1 minute'
FROM (VALUES
  ('c0000000-0000-0000-0000-000000000001','inbound','I need help with my order','Rohan Verma',6),
  ('c0000000-0000-0000-0000-000000000001','outbound','Sure! Please share your order ID.','Agent',4),
  ('c0000000-0000-0000-0000-000000000001','inbound','My order ID is #12345','Rohan Verma',2),
  ('c0000000-0000-0000-0000-000000000002','inbound','Do you have this in size M?','Ananya Singh',5),
  ('c0000000-0000-0000-0000-000000000003','inbound','How can I track my order?','Neha Patel',10),
  ('c0000000-0000-0000-0000-000000000004','inbound','What is your return policy?','Vikram Joshi',15),
  ('c0000000-0000-0000-0000-000000000005','outbound','Special offer just for you! 20% off today.','Marketing',20),
  ('c0000000-0000-0000-0000-000000000006','inbound','[Missed voice call]','Amit Kumar',25),
  ('c0000000-0000-0000-0000-000000000007','inbound','Is cash on delivery available?','Rohan Verma',40),
  ('c0000000-0000-0000-0000-000000000009','inbound','Any offers on bulk orders?','Neha Patel',180)
) AS v(cid, dir, body, sender, mins);

-- ---------- Campaigns ----------
INSERT INTO campaigns (organization_id, name, type, channel_type, message_body, status, scheduled_at) VALUES
  ('11111111-1111-1111-1111-111111111111','Diwali Sale Blast','broadcast','whatsapp','Hi {{name}}, check out our Diwali collection!','sent', now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111','New Arrivals','broadcast','instagram','New arrivals just dropped 🎉','scheduled', now() + interval '1 day'),
  ('11111111-1111-1111-1111-111111111111','Cart Reminder','drip','email','You left something in your cart 🛒','draft', NULL)
ON CONFLICT DO NOTHING;

-- ---------- Ecommerce orders (paid ones drive Revenue Impact) ----------
INSERT INTO ecommerce_orders (organization_id, contact_id, amount, payment_type, status)
SELECT '11111111-1111-1111-1111-111111111111', c.id, v.amount, v.ptype, v.status
FROM (VALUES
  ('rohan@example.com',120000,'prepaid','paid'),
  ('ananya@example.com',80000,'prepaid','completed'),
  ('neha@example.com',45000,'cod','paid'),
  ('vikram@example.com',15000,'cod','pending')
) AS v(email, amount, ptype, status)
JOIN contacts c ON c.email=v.email AND c.organization_id='11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- ---------- Abandoned carts ----------
INSERT INTO carts (organization_id, contact_id, value, recovered)
SELECT '11111111-1111-1111-1111-111111111111', c.id, v.value, v.rec
FROM (VALUES
  ('pooja@example.com',5400,true),
  ('amit@example.com',7800,false),
  ('neha@example.com',3200,true)
) AS v(email, value, rec)
JOIN contacts c ON c.email=v.email AND c.organization_id='11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- ---------- Reviews & social ----------
INSERT INTO reviews (organization_id, source, author, rating, body, reply) VALUES
  ('11111111-1111-1111-1111-111111111111','google','Rohan Verma',5,'Great service! Very quick response.',NULL),
  ('11111111-1111-1111-1111-111111111111','google','Sana Iyer',4,'Good products, fast delivery.','Thank you Sana!')
ON CONFLICT DO NOTHING;

INSERT INTO social_comments (organization_id, source, author, body, reply) VALUES
  ('11111111-1111-1111-1111-111111111111','facebook','Ananya Singh','Do you have this in blue?',NULL),
  ('11111111-1111-1111-1111-111111111111','linkedin','Neha Patel','Amazing collection!',NULL)
ON CONFLICT DO NOTHING;
