-- =====================================================================
-- Seed data for Lead Automation (org: Electrobtech Innovations)
-- Login: admin@electrobtech.com / Admin@123
-- Safe to run on a fresh database (created by scripts/setup-db.sh / compose).
-- =====================================================================

-- FIX: previously there was NO seed row for platform_admins at all — the
-- only way to get super-admin access was to manually run
-- scripts/create-super-admin.js from the host after the database was up,
-- which is easy to miss and looks identical to "Invalid credentials" in the
-- UI either way. This gives every fresh database a default super admin so
-- docker compose up alone is enough to reach /super-admin/login.
--
-- Login: superadmin@platform.local / SuperAdmin@123
-- CHANGE THIS PASSWORD before using this anywhere but local dev — rotate it
-- by re-running scripts/create-super-admin.js with the same email (it does
-- an ON CONFLICT (email) DO UPDATE of the password) e.g.:
--   DATABASE_URL=postgres://lead:leadpass@localhost:5435/lead_automation \
--     node scripts/create-super-admin.js --name "Super Admin" \
--     --email superadmin@platform.local --password 'YourNewPassword!'
INSERT INTO platform_admins (name, email, password_hash, status) VALUES
  ('Super Admin', 'superadmin@platform.local',
   '$2b$10$PRZwYb9.tQaZN3pohz7PQ.w3c.b6CaLoqKRNxROMDjs29THEYmPJe', 'active')
ON CONFLICT (email) DO NOTHING;

INSERT INTO roles (name, description) VALUES
  ('owner',   'Tenant owner — full access, billing, and org settings'),
  ('admin',   'Full access'),
  ('manager', 'Manage team and campaigns'),
  ('agent',   'Handle conversations'),
  ('viewer',  'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- ---------- RBAC permission catalogue + role mapping ----------
INSERT INTO permissions (code, description) VALUES
  ('contacts:read',   'View contacts & leads'),
  ('contacts:write',  'Create/update contacts & leads'),
  ('contacts:delete', 'Delete contacts'),
  ('campaigns:read',  'View campaigns'),
  ('campaigns:write', 'Create/update campaigns'),
  ('campaigns:send',  'Send/broadcast a campaign'),
  ('inbox:read',      'View conversations'),
  ('inbox:write',     'Reply to / manage conversations'),
  ('team:read',       'View team members & teams'),
  ('team:manage',     'Add/remove/edit team members and teams'),
  ('roles:manage',    'Manage roles and permission assignments'),
  ('settings:write',  'Change organization settings'),
  ('ai_agents:manage','Configure AI agents, knowledge base, webhooks'),
  ('audit:read',      'View audit logs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- FIX: 'owner' (the role every self-registered tenant gets via
-- POST /auth/register/company) previously had NO rows here at all, so
-- every owner-role JWT carried an empty `permissions` array and every
-- requirePermission()-gated route (campaigns:send, team:manage, etc.)
-- returned 403 for them. Owner gets the same full permission set as admin.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
 WHERE r.name = 'manager' AND p.code NOT IN ('roles:manage', 'settings:write')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
 WHERE r.name = 'agent' AND p.code IN ('contacts:read', 'contacts:write', 'campaigns:read', 'inbox:read', 'inbox:write', 'team:read')
ON CONFLICT DO NOTHING;

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

-- ---------- Message Templates ----------
-- Seeds the WhatsApp template created via the Template Creation module
-- (sidebar: Automation > Templates) so it ships with every fresh
-- database instead of only existing in whichever laptop's local Postgres
-- volume it was created in. Fixed id matches what was already issued to
-- the frontend/any campaigns referencing it, so re-running this seed
-- (e.g. after `docker compose up` on a new machine) is idempotent.
-- NOTE: header_media_url below is a placeholder — swap it for the real
-- hosted logo URL if the header image needs to render correctly.
INSERT INTO message_templates (
  id, organization_id, name, category, language, channels, status,
  header_type, header_text, header_media_url,
  body, body_variables, footer, buttons, created_by
) VALUES (
  '501e84c4-f52d-4f0b-bf62-97d324e5e45b',
  '11111111-1111-1111-1111-111111111111',
  'electrobtech_launch_update',
  'MARKETING',
  'en_US',
  '{WHATSAPP}',
  'APPROVED',
  'IMAGE',
  NULL,
  'https://cdn.corenexis.com/f/MeT8otelK1Q.webp',
  $body$🚀 **Exciting Updates from Electrobtech Innovations!**

Hello! 👋

We're excited to bring you the latest updates, offers, and solutions from **Electrobtech Innovations**.

✨ Discover our innovative technology solutions
📣 Stay updated with our latest announcements
💡 Get expert solutions tailored to your business needs

For more information, feel free to connect with our team.

**Electrobtech Innovations**
*Innovating Today, Empowering Tomorrow.* 🚀$body$,
  '{}',
  NULL,
  '[{"type":"PHONE_NUMBER","text":"Contact Us","value":"1234567890"}]',
  (SELECT id FROM users WHERE organization_id = '11111111-1111-1111-1111-111111111111' AND email = 'admin@electrobtech.com')
)
ON CONFLICT (id) DO NOTHING;

-- ---------- Contacts ----------
-- external_id mirrors phone here for the demo seed — for a real WhatsApp
-- contact this would be the raw wa_id Meta sends as msg.from (see
-- normalizeWhatsApp() in automation-service's webhookController.js), but
-- since these rows are inserted manually rather than resolved from a live
-- webhook, contacts.external_id would otherwise stay NULL and the Unified
-- Inbox's "Customer (simulate)" send mode would 422 with "no channel
-- identity to simulate a reply from" for every seeded conversation.
INSERT INTO contacts (organization_id, name, email, phone, source, external_id, tags) VALUES
  ('11111111-1111-1111-1111-111111111111','Rohan Verma','rohan@example.com','+919000000001','whatsapp','919000000001','{vip}'),
  ('11111111-1111-1111-1111-111111111111','Ananya Singh','ananya@example.com','+919000000002','instagram','919000000002','{}'),
  ('11111111-1111-1111-1111-111111111111','Neha Patel','neha@example.com','+919000000003','webchat','919000000003','{}'),
  ('11111111-1111-1111-1111-111111111111','Vikram Joshi','vikram@example.com','+919000000004','messenger','919000000004','{}'),
  ('11111111-1111-1111-1111-111111111111','Pooja Mehta','pooja@example.com','+919000000005','sms','919000000005','{}'),
  ('11111111-1111-1111-1111-111111111111','Amit Kumar','amit@example.com','+919000000006','voice','919000000006','{}')
ON CONFLICT DO NOTHING;

-- ---------- Leads ----------
-- deal_value + explicit created_at/updated_at gaps so the Sales Agent's
-- Forecasting/Analytics tabs (weighted pipeline, avg deal size, sales-cycle
-- days, weekly deals won) have real numbers to show on a fresh `docker
-- compose up` instead of being blank until someone hand-edits leads —
-- these still only appear once an org maps sales_agent_config.deal_value_field
-- to 'deal_value' in the Settings tab (deliberately not auto-set — see
-- migration 0005/0004 comments). Two 'won' leads (Vikram, Pooja) with
-- different creation->close gaps and months so sales_cycle_days averages
-- over more than one data point and weekly_deals_won isn't a single spike.
INSERT INTO leads (organization_id, contact_id, stage, priority, score, deal_value, created_at, updated_at)
SELECT '11111111-1111-1111-1111-111111111111', c.id, v.stage, v.priority, v.score, v.deal_value,
       now() - (v.created_days_ago || ' days')::interval,
       now() - (v.updated_days_ago || ' days')::interval
FROM (VALUES
  ('rohan@example.com','active','high',82,45000.00, 10, 1),
  ('ananya@example.com','qualified','medium',60,28000.00, 6, 2),
  ('neha@example.com','new','low',35,15000.00, 2, 2),
  ('vikram@example.com','won','high',95,60000.00, 12, 3),
  ('pooja@example.com','won','high',90,82000.00, 40, 25),
  ('amit@example.com','active','medium',55,32000.00, 4, 1)
) AS v(email, stage, priority, score, deal_value, created_days_ago, updated_days_ago)
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

-- ---------- Google Reviews (mock — Google Business Profile API access is
-- temporarily unavailable) ----------
-- Seeds the same google_accounts / google_locations / google_reviews tables
-- the real Google integration uses (services/review-service/src/google/),
-- so the UI, reply flow, and stats all work unmodified. The mock location's
-- id is prefixed "mock-" — services/review-service/src/google/routes.js
-- checks that prefix to skip real Google API calls when replying, so
-- replies work without a live Google connection. Delete these rows (or
-- just connect a real account) once real API access is restored.
--
-- NOTE: this same INSERT also lives in
-- migrations/033_mock_google_reviews.sql so it can be re-run by hand
-- against a database that was already initialized before this change —
-- keep both in sync if you edit the mock reviews.
INSERT INTO google_accounts (organization_id, account_id, account_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'accounts/mock-electrobtech', 'Electrobtech Innovations (Mock)')
ON CONFLICT (organization_id, account_id) DO NOTHING;

INSERT INTO google_locations (organization_id, account_id, location_id, location_name, address, phone, is_selected) VALUES
  ('11111111-1111-1111-1111-111111111111', 'accounts/mock-electrobtech', 'locations/mock-electrobtech-1',
   'Electrobtech Innovations — HSR Layout', 'HSR Layout, Bengaluru, Karnataka, India', '+91 80 4000 1234', true)
ON CONFLICT (organization_id, location_id) DO NOTHING;

INSERT INTO google_reviews (
  organization_id, location_id, review_id, reviewer_name, reviewer_photo_url,
  star_rating, comment, create_time, update_time, reply_comment, reply_update_time
) VALUES
  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-01', 'Rohan Verma',   'https://i.pravatar.cc/150?img=11',
   5, 'Excellent service! The team was quick to respond and resolved my issue same day.',
   now() - interval '2 days', now() - interval '2 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-02', 'Sana Iyer',     'https://i.pravatar.cc/150?img=32',
   4, 'Good products and fast delivery. Packaging could be a little sturdier.',
   now() - interval '4 days', now() - interval '3 days',
   'Thanks for the feedback, Sana! We are working on improving our packaging.', now() - interval '3 days'),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-03', 'Arjun Mehta',   'https://i.pravatar.cc/150?img=13',
   2, 'Delivery was late and the packaging was damaged when it arrived.',
   now() - interval '6 days', now() - interval '6 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-04', 'Priya Nair',    'https://i.pravatar.cc/150?img=25',
   5, 'Absolutely love this store! Staff are friendly and very knowledgeable.',
   now() - interval '8 days', now() - interval '7 days',
   'Thank you so much, Priya — see you again soon!', now() - interval '7 days'),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-05', 'Karan Malhotra','https://i.pravatar.cc/150?img=14',
   3, 'Decent experience overall, nothing extraordinary. Prices are a bit high.',
   now() - interval '10 days', now() - interval '10 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-06', 'Neha Patel',    'https://i.pravatar.cc/150?img=47',
   5, 'Best customer support I have experienced in a long time. Highly recommend!',
   now() - interval '12 days', now() - interval '11 days',
   'We really appreciate this, Neha! Thank you for the kind words.', now() - interval '11 days'),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-07', 'Vikram Rao',    'https://i.pravatar.cc/150?img=15',
   1, 'Very disappointed. The product I received did not match the description at all.',
   now() - interval '14 days', now() - interval '14 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-08', 'Ananya Singh',  'https://i.pravatar.cc/150?img=44',
   4, 'Great range of products. Checkout took a little longer than expected.',
   now() - interval '16 days', now() - interval '16 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-09', 'Rahul Deshmukh','https://i.pravatar.cc/150?img=18',
   5, 'Five stars for the quick turnaround and professional communication throughout.',
   now() - interval '18 days', now() - interval '17 days',
   'Thank you, Rahul! Glad we could help.', now() - interval '17 days'),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-10', 'Ishita Kapoor', 'https://i.pravatar.cc/150?img=29',
   2, 'The item arrived fine but customer service was slow to respond to my query.',
   now() - interval '20 days', now() - interval '20 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-11', 'Aditya Sharma', 'https://i.pravatar.cc/150?img=16',
   5, 'Impressed with the quality and the attention to detail. Will be back!',
   now() - interval '23 days', now() - interval '22 days',
   'That means a lot to us, Aditya — thank you!', now() - interval '22 days'),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-12', 'Meera Joshi',   'https://i.pravatar.cc/150?img=48',
   3, 'Average experience. The store was clean but the staff seemed understaffed.',
   now() - interval '26 days', now() - interval '26 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-13', 'Siddharth Rao', 'https://i.pravatar.cc/150?img=17',
   4, 'Solid experience overall. Would appreciate more payment options at checkout.',
   now() - interval '29 days', now() - interval '29 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-14', 'Tanvi Shah',    'https://i.pravatar.cc/150?img=45',
   5, 'Outstanding! They went above and beyond to make sure I was happy with my order.',
   now() - interval '33 days', now() - interval '32 days',
   'Thank you, Tanvi! We are thrilled to hear that.', now() - interval '32 days'),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-15', 'Farhan Khan',   'https://i.pravatar.cc/150?img=19',
   1, 'Ordered two weeks ago and still waiting on a resolution. Not happy.',
   now() - interval '36 days', now() - interval '36 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-16', 'Divya Menon',   'https://i.pravatar.cc/150?img=49',
   4, 'Really happy with my purchase. Delivery tracking could be more accurate though.',
   now() - interval '40 days', now() - interval '40 days', NULL, NULL),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-17', 'Gaurav Chawla', 'https://i.pravatar.cc/150?img=20',
   5, 'Consistently great service every time I visit. Keep it up!',
   now() - interval '44 days', now() - interval '43 days',
   'Thanks for being a loyal customer, Gaurav!', now() - interval '43 days'),

  ('11111111-1111-1111-1111-111111111111', 'locations/mock-electrobtech-1', 'mock-review-18', 'Kavya Reddy',   'https://i.pravatar.cc/150?img=26',
   3, 'Products are good but the website was a bit confusing to navigate.',
   now() - interval '48 days', now() - interval '48 days', NULL, NULL)

ON CONFLICT (organization_id, review_id) DO NOTHING;

-- ---------- Lead Automation (WhatsApp/Instagram playbook engine) ----------
-- Demo playbooks live as JSON fixtures in
-- services/automation-service/src/seeds/ and are loaded separately with
-- `npm run seed` (from services/automation-service) rather than inserted
-- here directly, since they're maintained/versioned alongside the flow
-- builder rather than as bootstrap CRM data.