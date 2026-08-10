-- =====================================================================
-- Marketing Hub demo data (org: Electrobtech Innovations, same org as
-- infra/db/seed.sql). Runs after seed.sql (02) and before rls.sql (03) —
-- RLS isn't enabled yet at this point in docker-entrypoint-initdb.d, so
-- no app_rls_bypass() dance is needed here, same as seed.sql itself.
--
-- Why this file exists: every Marketing Hub page reads from real Postgres
-- tables (see routes/*.js) — there was nothing wrong with the queries,
-- but a fresh `docker compose up` gave every table 0 rows, so every tab
-- looked broken/empty even though it wasn't. This gives each tab ~15 real,
-- internally-consistent rows (counts are computed from the recipient rows
-- actually inserted below, not made up) so the app is demo-ready out of
-- the box. Safe to delete this file entirely if you don't want demo data —
-- nothing else in the app depends on it existing.
-- =====================================================================

-- ---------- More contacts, with tags, so audience tag-filters have
-- something real to match (seed.sql's original 6 contacts only carry one
-- tag between them) ----------
INSERT INTO contacts (organization_id, name, email, phone, source, external_id, tags)
SELECT '11111111-1111-1111-1111-111111111111', v.name, v.email, v.phone, v.source, v.phone, v.tags
FROM (VALUES
  ('Rahul Nair','rahul.nair@example.com','+919000001001','whatsapp','{vip,enterprise}'::text[]),
  ('Sneha Reddy','sneha.reddy@example.com','+919000001002','instagram','{newsletter}'::text[]),
  ('Arjun Das','arjun.das@example.com','+919000001003','webchat','{trial}'::text[]),
  ('Kavya Iyer','kavya.iyer@example.com','+919000001004','whatsapp','{vip}'::text[]),
  ('Manish Gupta','manish.gupta@example.com','+919000001005','messenger','{smb}'::text[]),
  ('Divya Rao','divya.rao@example.com','+919000001006','sms','{newsletter,trial}'::text[]),
  ('Sanjay Pillai','sanjay.pillai@example.com','+919000001007','whatsapp','{enterprise}'::text[]),
  ('Meera Krishnan','meera.krishnan@example.com','+919000001008','instagram','{webinar-attendee}'::text[]),
  ('Aditya Bhatt','aditya.bhatt@example.com','+919000001009','webchat','{demo-requested}'::text[]),
  ('Ritu Chawla','ritu.chawla@example.com','+919000001010','whatsapp','{vip,newsletter}'::text[]),
  ('Karthik Subramaniam','karthik.s@example.com','+919000001011','messenger','{smb,trial}'::text[]),
  ('Ishita Malhotra','ishita.malhotra@example.com','+919000001012','sms','{price-sensitive}'::text[]),
  ('Varun Menon','varun.menon@example.com','+919000001013','whatsapp','{enterprise,vip}'::text[]),
  ('Nisha Kapoor','nisha.kapoor@example.com','+919000001014','instagram','{newsletter}'::text[]),
  ('Rohit Saxena','rohit.saxena@example.com','+919000001015','webchat','{demo-requested,trial}'::text[]),
  ('Priyanka Desai','priyanka.desai@example.com','+919000001016','whatsapp','{vip}'::text[]),
  ('Gaurav Chatterjee','gaurav.c@example.com','+919000001017','sms','{churn-risk}'::text[]),
  ('Swati Agarwal','swati.agarwal@example.com','+919000001018','messenger','{smb}'::text[]),
  ('Naveen Kumar','naveen.kumar@example.com','+919000001019','whatsapp','{webinar-attendee,trial}'::text[]),
  ('Deepika Shah','deepika.shah@example.com','+919000001020','instagram','{newsletter,vip}'::text[]),
  ('Suresh Babu','suresh.babu@example.com','+919000001021','webchat','{price-sensitive}'::text[]),
  ('Anjali Bose','anjali.bose@example.com','+919000001022','whatsapp','{enterprise}'::text[]),
  ('Vivek Anand','vivek.anand@example.com','+919000001023','sms','{demo-requested}'::text[]),
  ('Pallavi Nambiar','pallavi.nambiar@example.com','+919000001024','messenger','{smb,newsletter}'::text[]),
  ('Harish Ramachandran','harish.r@example.com','+919000001025','whatsapp','{trial}'::text[]),
  ('Lakshmi Venkatesh','lakshmi.v@example.com','+919000001026','instagram','{vip,webinar-attendee}'::text[]),
  ('Tarun Khanna','tarun.khanna@example.com','+919000001027','webchat','{churn-risk}'::text[]),
  ('Bhavna Jain','bhavna.jain@example.com','+919000001028','whatsapp','{newsletter}'::text[]),
  ('Yash Trivedi','yash.trivedi@example.com','+919000001029','sms','{smb,trial}'::text[]),
  ('Radhika Pandey','radhika.pandey@example.com','+919000001030','messenger','{enterprise,newsletter}'::text[])
) AS v(name, email, phone, source, tags)
ON CONFLICT DO NOTHING;

-- ---------- Audiences (15) — tag-based, matches what audienceResolver.js
-- resolves against contacts.tags. size_cached is a REAL count of matching
-- contacts, not a made-up number. ----------
INSERT INTO mh_audiences (organization_id, name, source, filter, size_cached, size_computed_at, status, created_by)
SELECT '11111111-1111-1111-1111-111111111111', v.name, 'tag_filter', jsonb_build_object('tags', v.tags),
       (SELECT count(*)::int FROM contacts c WHERE c.organization_id='11111111-1111-1111-1111-111111111111' AND c.tags && v.tags),
       now() - (v.n::text || ' hours')::interval,
       'active',
       (SELECT id FROM users WHERE email='admin@electrobtech.com')
FROM (VALUES
  ('VIP Customers',           ARRAY['vip']::text[], 1),
  ('Newsletter Subscribers',  ARRAY['newsletter']::text[], 2),
  ('Free Trial Users',        ARRAY['trial']::text[], 3),
  ('Enterprise Accounts',     ARRAY['enterprise']::text[], 4),
  ('SMB Segment',             ARRAY['smb']::text[], 5),
  ('Webinar Attendees',       ARRAY['webinar-attendee']::text[], 6),
  ('Demo Requested — Hot Leads', ARRAY['demo-requested']::text[], 7),
  ('Price-Sensitive Shoppers',ARRAY['price-sensitive']::text[], 8),
  ('Churn Risk — Win Back',   ARRAY['churn-risk']::text[], 9),
  ('VIP + Newsletter',        ARRAY['vip','newsletter']::text[], 10),
  ('Trial + SMB',             ARRAY['trial','smb']::text[], 11),
  ('Enterprise + VIP',        ARRAY['enterprise','vip']::text[], 12),
  ('All Trial Users',         ARRAY['trial','demo-requested']::text[], 13),
  ('Full Contact List',       ARRAY['vip','newsletter','trial','enterprise','smb','webinar-attendee','demo-requested','price-sensitive','churn-risk']::text[], 14),
  ('Q3 Re-engagement',        ARRAY['churn-risk','price-sensitive']::text[], 15)
) AS v(name, tags, n)
ON CONFLICT DO NOTHING;

-- ---------- Campaigns + Broadcasts (15 total: 10 campaigns, 5 broadcasts)
-- across every channel/status the UI filters on. total_recipients is set
-- here; sent/delivered/read/replied/failed counts get UPDATEd below from
-- the actual mh_recipients rows inserted for each one, so the numbers on
-- screen are internally consistent instead of fabricated. ----------
WITH new_campaigns AS (
  INSERT INTO mh_campaigns (organization_id, kind, name, channel, objective, audience_id, message_body, budget_amount, status, start_date, end_date, total_recipients, created_by, created_at)
  SELECT '11111111-1111-1111-1111-111111111111', v.kind, v.name, v.channel, v.objective,
         (SELECT id FROM mh_audiences WHERE organization_id='11111111-1111-1111-1111-111111111111' AND name=v.audience_name),
         v.message_body, v.budget, v.status,
         (CURRENT_DATE - (v.days_ago::text || ' days')::interval)::date,
         (CURRENT_DATE - (v.days_ago::text || ' days')::interval + interval '14 days')::date,
         v.recipients,
         (SELECT id FROM users WHERE email='admin@electrobtech.com'),
         now() - (v.days_ago::text || ' days')::interval
  FROM (VALUES
    ('campaign', 'Diwali Flash Sale',        'whatsapp',   'Sales',            'VIP Customers',            'Hi {{name}}! Diwali Flash Sale is live — 30% off everything for 48 hours only.', 15000, 'completed', 12, 28),
    ('campaign', 'Free Trial Nurture',       'email',      'Lead Generation',  'Free Trial Users',         'Subject: Getting the most out of your trial\n\nHi {{name}}, here are 3 quick wins for week one.', 5000,  'completed', 20, 22),
    ('campaign', 'Enterprise Webinar Invite','email',      'Event Promotion',  'Enterprise Accounts',      'Subject: You are invited — Enterprise Growth Webinar\n\nJoin us live on Thursday.', 8000, 'processing', 3, 18),
    ('campaign', 'SMB Product Launch',       'whatsapp',   'Product Launch',   'SMB Segment',               'Hi {{name}}, our new SMB plan just launched — built for teams like yours.', 12000, 'draft', 0, 0),
    ('campaign', 'Win-Back Churned Users',   'email',      'Retargeting',      'Churn Risk — Win Back',     'Subject: We miss you, {{name}}\n\nHere is 20% off to come back.', 6000, 'completed', 18, 15),
    ('campaign', 'Instagram Retargeting',    'instagram',  'Retargeting',      'Price-Sensitive Shoppers',  'Still thinking it over? Here is a limited-time discount just for you.', 4000, 'paused', 6, 20),
    ('campaign', 'App Download Push',        'sms',        'App Downloads',    'Trial + SMB',               'Get the app for exclusive deals — download now: [link]', 3000, 'completed', 25, 8),
    ('campaign', 'LinkedIn Enterprise Push', 'linkedin',   'Lead Generation',  'Enterprise + VIP',          'We help enterprise teams cut onboarding time by 40%. Let''s talk.', 10000, 'scheduled', 0, 0),
    ('campaign', 'Webinar Follow-up',        'email',      'Event Promotion',  'Webinar Attendees',         'Subject: Thanks for joining — here is the recording\n\nHi {{name}}, missed something? Watch again here.', 2000, 'completed', 14, 12),
    ('campaign', 'Q3 Reactivation Drip',     'messenger',  'Retargeting',      'Q3 Re-engagement',          'Hey {{name}}, been a while! Here is what''s new since you last checked in.', 3500, 'failed', 9, 25),
    ('broadcast','Flash Sale Alert',         'whatsapp',   NULL,               'Full Contact List',         'FLASH SALE: 40% off next 6 hours only! Shop now.', NULL, 'completed', 1, 4),
    ('broadcast','New Feature Announcement', 'whatsapp',   NULL,               'Newsletter Subscribers',    'We just shipped something you asked for — check it out!', NULL, 'completed', 5, 9),
    ('broadcast','Weekend Deals',            'sms',        NULL,               'Price-Sensitive Shoppers',  'Weekend only: extra 15% off with code WKND15', NULL, 'processing', 0, 10),
    ('broadcast','Maintenance Notice',       'email',      NULL,               'Full Contact List',         'Subject: Scheduled maintenance this weekend\n\nWe will be briefly offline Saturday 2-4am IST.', NULL, 'draft', 0, 0),
    ('broadcast','VIP Early Access',         'whatsapp',   NULL,               'VIP Customers',             'You get early access 24h before everyone else — starts now.', NULL, 'completed', 2, 6)
  ) AS v(kind, name, channel, objective, audience_name, message_body, budget, status, days_ago, recipients)
  RETURNING id, kind, name, channel, status, total_recipients
)
SELECT 1; -- CTE materialized above; recipients/counters filled in below

-- ---------- Recipients + delivery events, per campaign — status mix
-- varies by campaign so the funnel/AI-score numbers aren't uniform.
-- Destinations reuse the real contact pool (cycled with a per-campaign
-- offset so the UNIQUE(campaign_id, destination) index never collides). ----------
DO $$
DECLARE
  camp RECORD;
  contact_ids UUID[];
  contact_count INT;
  offset_base INT := 0;
  i INT;
  n INT;
  chosen_contact UUID;
  dest TEXT;
  rec_id UUID;
  roll NUMERIC;
  final_status TEXT;
  sent_ts TIMESTAMPTZ;
BEGIN
  SELECT array_agg(id ORDER BY created_at), count(*) INTO contact_ids, contact_count
  FROM contacts WHERE organization_id = '11111111-1111-1111-1111-111111111111';

  FOR camp IN
    SELECT id, channel, status, total_recipients FROM mh_campaigns
    WHERE organization_id = '11111111-1111-1111-1111-111111111111' AND total_recipients > 0
  LOOP
    n := LEAST(camp.total_recipients, contact_count);
    offset_base := offset_base + 7; -- stagger which contacts each campaign picks
    FOR i IN 1..n LOOP
      chosen_contact := contact_ids[((i + offset_base) % contact_count) + 1];
      SELECT COALESCE(phone, email) INTO dest FROM contacts WHERE id = chosen_contact;

      roll := random();
      -- Draft/scheduled campaigns never actually sent anything yet.
      IF camp.status IN ('draft', 'scheduled') THEN
        final_status := 'queued';
      ELSIF camp.status = 'failed' THEN
        final_status := CASE WHEN roll < 0.6 THEN 'failed' WHEN roll < 0.85 THEN 'sent' ELSE 'delivered' END;
      ELSIF camp.status = 'processing' THEN
        final_status := CASE WHEN roll < 0.3 THEN 'queued' WHEN roll < 0.6 THEN 'sent' WHEN roll < 0.85 THEN 'delivered' ELSE 'read' END;
      ELSE -- completed / paused
        final_status := CASE
          WHEN roll < 0.06 THEN 'failed'
          WHEN roll < 0.20 THEN 'sent'
          WHEN roll < 0.45 THEN 'delivered'
          WHEN roll < 0.80 THEN 'read'
          ELSE 'replied'
        END;
      END IF;

      sent_ts := now() - ((n - i)::text || ' minutes')::interval;

      INSERT INTO mh_recipients (campaign_id, contact_id, channel, destination, display_name, rendered_message, status, attempts, error, sent_at, delivered_at, read_at, replied_at, created_at)
      VALUES (
        camp.id, chosen_contact, camp.channel, dest,
        (SELECT name FROM contacts WHERE id = chosen_contact),
        NULL,
        final_status,
        CASE WHEN final_status = 'failed' THEN 2 WHEN final_status = 'queued' THEN 0 ELSE 1 END,
        CASE WHEN final_status = 'failed' THEN 'Delivery failed: recipient unreachable' ELSE NULL END,
        CASE WHEN final_status IN ('sent','delivered','read','replied') THEN sent_ts ELSE NULL END,
        CASE WHEN final_status IN ('delivered','read','replied') THEN sent_ts + interval '2 minutes' ELSE NULL END,
        CASE WHEN final_status IN ('read','replied') THEN sent_ts + interval '8 minutes' ELSE NULL END,
        CASE WHEN final_status = 'replied' THEN sent_ts + interval '25 minutes' ELSE NULL END,
        sent_ts
      )
      ON CONFLICT (campaign_id, destination) DO NOTHING
      RETURNING id INTO rec_id;

      IF rec_id IS NOT NULL AND final_status <> 'queued' THEN
        INSERT INTO mh_delivery_events (recipient_id, campaign_id, event_type, occurred_at, payload)
        VALUES (rec_id, camp.id, CASE WHEN final_status='failed' THEN 'failed' ELSE 'sent' END, sent_ts, '{"simulated": true}');
        IF final_status IN ('delivered','read','replied') THEN
          INSERT INTO mh_delivery_events (recipient_id, campaign_id, event_type, occurred_at, payload)
          VALUES (rec_id, camp.id, 'delivered', sent_ts + interval '2 minutes', '{"simulated": true}');
        END IF;
        IF final_status IN ('read','replied') THEN
          INSERT INTO mh_delivery_events (recipient_id, campaign_id, event_type, occurred_at, payload)
          VALUES (rec_id, camp.id, 'read', sent_ts + interval '8 minutes', '{"simulated": true}');
        END IF;
        IF final_status = 'replied' THEN
          INSERT INTO mh_delivery_events (recipient_id, campaign_id, event_type, occurred_at, payload)
          VALUES (rec_id, camp.id, 'replied', sent_ts + interval '25 minutes', '{"simulated": true}');
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Roll the real recipient rows back up into each campaign's counters —
  -- this is the step that keeps the numbers shown on the Campaigns/
  -- Broadcasts pages honest instead of inventing them separately.
  UPDATE mh_campaigns c SET
    sent_count      = COALESCE(r.sent, 0),
    delivered_count = COALESCE(r.delivered, 0),
    read_count      = COALESCE(r.read, 0),
    replied_count   = COALESCE(r.replied, 0),
    failed_count    = COALESCE(r.failed, 0)
  FROM (
    SELECT campaign_id,
      count(*) FILTER (WHERE status IN ('sent','delivered','read','replied')) AS sent,
      count(*) FILTER (WHERE status IN ('delivered','read','replied')) AS delivered,
      count(*) FILTER (WHERE status IN ('read','replied')) AS read,
      count(*) FILTER (WHERE status = 'replied') AS replied,
      count(*) FILTER (WHERE status = 'failed') AS failed
    FROM mh_recipients GROUP BY campaign_id
  ) r
  WHERE r.campaign_id = c.id AND c.organization_id = '11111111-1111-1111-1111-111111111111';
END $$;

-- ---------- Assets (15) ----------
INSERT INTO mh_assets (organization_id, name, type, file_path, file_size, mime_type, tags, metadata)
SELECT '11111111-1111-1111-1111-111111111111', v.name, v.type, v.path, v.size, v.mime, v.tags, '{"seeded": true}'
FROM (VALUES
  ('Diwali Sale Banner',        'image',    '/uploads/marketing/diwali-banner.jpg',       420000, 'image/jpeg', ARRAY['sale','diwali']::text[]),
  ('Product Demo Video',        'video',    '/uploads/marketing/product-demo.mp4',       8500000, 'video/mp4',  ARRAY['product','demo']::text[]),
  ('Brand Guidelines PDF',      'document', '/uploads/marketing/brand-guidelines.pdf',    950000, 'application/pdf', ARRAY['brand']::text[]),
  ('Instagram Story Template',  'template', '/uploads/marketing/ig-story-template.psd',   310000, 'application/octet-stream', ARRAY['social','template']::text[]),
  ('Webinar Recording',         'video',    '/uploads/marketing/webinar-recording.mp4',12400000, 'video/mp4',  ARRAY['webinar']::text[]),
  ('Email Header Graphic',      'image',    '/uploads/marketing/email-header.png',        180000, 'image/png',  ARRAY['email']::text[]),
  ('Case Study — Enterprise',   'document', '/uploads/marketing/case-study-enterprise.pdf',720000, 'application/pdf', ARRAY['case-study','enterprise']::text[]),
  ('Podcast Intro Audio',       'audio',    '/uploads/marketing/podcast-intro.mp3',       2100000, 'audio/mpeg', ARRAY['podcast']::text[]),
  ('New Year Sale Banner',      'image',    '/uploads/marketing/new-year-banner.jpg',     395000, 'image/jpeg', ARRAY['sale']::text[]),
  ('Feature Announcement GIF',  'image',    '/uploads/marketing/feature-announcement.gif',890000, 'image/gif',  ARRAY['product']::text[]),
  ('Onboarding Explainer Video','video',    '/uploads/marketing/onboarding-explainer.mp4',6700000, 'video/mp4',  ARRAY['onboarding']::text[]),
  ('Pitch Deck Template',       'template', '/uploads/marketing/pitch-deck-template.pptx', 1200000, 'application/octet-stream', ARRAY['sales','template']::text[]),
  ('Customer Testimonial Reel', 'video',    '/uploads/marketing/testimonial-reel.mp4',   4300000, 'video/mp4',  ARRAY['testimonial']::text[]),
  ('Newsletter Header',         'image',    '/uploads/marketing/newsletter-header.png',   210000, 'image/png',  ARRAY['newsletter']::text[]),
  ('Pricing One-Pager',         'document', '/uploads/marketing/pricing-onepager.pdf',    340000, 'application/pdf', ARRAY['sales']::text[])
) AS v(name, type, path, size, mime, tags)
ON CONFLICT DO NOTHING;

-- ---------- Templates (15) ----------
INSERT INTO mh_templates (organization_id, name, category, channel, content, usage_count, is_public)
SELECT '11111111-1111-1111-1111-111111111111', v.name, v.category, v.channel, v.content, v.uses, v.pub
FROM (VALUES
  ('Welcome Message',        'onboarding', 'whatsapp', '{"body":"Hi {{name}}! Welcome aboard — excited to have you here."}'::jsonb, 142, true),
  ('Cart Abandonment',       'sales',      'email',    '{"subject":"You left something behind","body":"Hi {{name}}, your cart is waiting — here is 10% off to finish up."}'::jsonb, 89, true),
  ('Flash Sale Alert',       'promotions', 'whatsapp', '{"body":"⚡ Flash sale — {{discount}}% off for the next {{hours}} hours!"}'::jsonb, 210, true),
  ('Webinar Reminder',       'events',     'email',    '{"subject":"Starting soon: {{webinar_name}}","body":"Hi {{name}}, we go live in 1 hour. See you there!"}'::jsonb, 34, false),
  ('Order Confirmation',     'transactional','sms',    '{"body":"Order #{{order_id}} confirmed! Track it here: {{link}}"}'::jsonb, 512, true),
  ('Re-engagement',          'retention',  'email',    '{"subject":"We miss you, {{name}}","body":"It has been a while — here is what is new."}'::jsonb, 67, false),
  ('Product Launch',         'promotions', 'instagram','{"body":"Introducing {{product_name}} — available now!"}'::jsonb, 45, true),
  ('Feedback Request',       'engagement', 'whatsapp', '{"body":"Hi {{name}}, how was your experience with {{product}}? Reply 1-5."}'::jsonb, 98, false),
  ('Renewal Reminder',       'retention',  'email',    '{"subject":"Your plan renews in {{days}} days","body":"Hi {{name}}, just a heads up before renewal."}'::jsonb, 23, false),
  ('Referral Invite',        'growth',     'whatsapp', '{"body":"Love using us? Invite a friend and you both get {{reward}}."}'::jsonb, 156, true),
  ('Event Follow-up',        'events',     'email',    '{"subject":"Thanks for coming!","body":"Hi {{name}}, here is the recap and slides from {{event_name}}."}'::jsonb, 18, false),
  ('Price Drop Alert',       'promotions', 'sms',      '{"body":"Price drop on {{product}} — now {{price}}. Limited time."}'::jsonb, 76, true),
  ('Survey Invite',          'engagement', 'email',    '{"subject":"2-minute survey — help us improve","body":"Hi {{name}}, your feedback shapes our roadmap."}'::jsonb, 41, false),
  ('Appointment Reminder',   'transactional','whatsapp','{"body":"Reminder: your appointment is on {{date}} at {{time}}."}'::jsonb, 289, true),
  ('Holiday Greeting',       'engagement', 'instagram','{"body":"Wishing you a wonderful {{holiday}} from all of us! 🎉"}'::jsonb, 52, true)
) AS v(name, category, channel, content, uses, pub)
ON CONFLICT DO NOTHING;

-- ---------- Content Studio items (15) ----------
INSERT INTO mh_content_studio (organization_id, name, type, channel, content, status, tags, performance)
SELECT '11111111-1111-1111-1111-111111111111', v.name, v.type, v.channel, jsonb_build_object('body', v.body), v.status, v.tags, v.perf
FROM (VALUES
  ('Diwali Sale — WhatsApp Post',   'post',     'whatsapp',  'Diwali Flash Sale is here! 30% off everything, 48 hours only. Shop now →', 'published', ARRAY['EdTech','Drive Sign-ups']::text[], '{"views": 1240}'::jsonb),
  ('Trial Nurture — Email 1',       'campaign', 'email',     'Subject: Getting the most out of your trial\n\nHi there, here are 3 quick wins for week one.', 'published', ARRAY['SaaS','Generate Leads']::text[], '{"opens": 320}'::jsonb),
  ('Enterprise Webinar Invite',     'campaign', 'email',     'Subject: You''re invited — Enterprise Growth Webinar\n\nJoin us live this Thursday at 3pm.', 'approved', ARRAY['SaaS','Event Registrations']::text[], '{}'::jsonb),
  ('New Feature — Instagram Post',  'post',     'instagram', 'We just shipped something you asked for 👀 Swipe to see what''s new.', 'published', ARRAY['SaaS','Increase Awareness']::text[], '{"likes": 89}'::jsonb),
  ('SMB Launch Ad Copy',            'post',     'whatsapp',  'Built for teams like yours — our new SMB plan is here. Try it free for 14 days.', 'draft', ARRAY['SaaS','Drive Sign-ups']::text[], '{}'::jsonb),
  ('Win-Back Email Draft',          'campaign', 'email',     'Subject: We miss you\n\nHere''s 20% off to come back and see what''s changed.', 'review', ARRAY['E-commerce','Boost Sales']::text[], '{}'::jsonb),
  ('Blog Outline — Onboarding',     'post',     'email',     '1. Why onboarding matters\n2. Common mistakes\n3. Our 5-step framework\n4. Case study\n5. Checklist', 'draft', ARRAY['SaaS','Increase Awareness']::text[], '{}'::jsonb),
  ('Weekend Deal SMS',              'post',     'sms',       'Weekend only: extra 15% off with code WKND15. Ends Sunday midnight.', 'published', ARRAY['E-commerce','Boost Sales']::text[], '{"clicks": 156}'::jsonb),
  ('Webinar Recap Social',          'post',     'instagram', 'Missed the webinar? Full recording is up — link in bio.', 'published', ARRAY['SaaS','Event Registrations']::text[], '{"likes": 44}'::jsonb),
  ('Referral Program Post',         'post',     'whatsapp',  'Love using us? Invite a friend — you both get 1 month free.', 'approved', ARRAY['SaaS','Generate Leads']::text[], '{}'::jsonb),
  ('Holiday Campaign Draft',        'campaign', 'email',     'Subject: Season''s greetings from our team\n\nWishing you a wonderful season — here''s a small thank-you gift.', 'draft', ARRAY['E-commerce','Increase Awareness']::text[], '{}'::jsonb),
  ('App Download Push Copy',        'post',     'sms',       'Get the app for exclusive deals — download now: bit.ly/getapp', 'published', ARRAY['E-commerce','App Downloads']::text[], '{"clicks": 210}'::jsonb),
  ('LinkedIn Enterprise Outreach',  'post',     'linkedin',  'We help enterprise teams cut onboarding time by 40%. Curious how? Let''s talk.', 'approved', ARRAY['SaaS','Generate Leads']::text[], '{}'::jsonb),
  ('Customer Story Highlight',      'post',     'instagram', 'From 200 to 2,000 users in 6 months — here''s how @customer did it.', 'published', ARRAY['SaaS','Increase Awareness']::text[], '{"likes": 132}'::jsonb),
  ('Price Increase Notice',         'campaign', 'email',     'Subject: An update on our pricing\n\nHi there, we''re updating our plans starting next month.', 'review', ARRAY['SaaS','Retargeting']::text[], '{}'::jsonb)
) AS v(name, type, channel, body, status, tags, perf)
ON CONFLICT DO NOTHING;

-- ---------- SEO keywords (15) ----------
INSERT INTO mh_seo_keywords (organization_id, keyword, search_volume, difficulty, current_rank, target_rank, url, competition, cpc)
SELECT '11111111-1111-1111-1111-111111111111', v.kw, v.vol, v.diff, v.rank, v.target, v.url, v.comp, v.cpc
FROM (VALUES
  ('best crm for small teams',        8200, 62, 7,  3, '/blog/best-crm-small-teams', 0.71, 4.20),
  ('whatsapp marketing automation',   5400, 58, 4,  1, '/features/whatsapp-automation', 0.65, 3.10),
  ('lead generation software',       12000, 74, 12, 5, '/product/lead-generation', 0.82, 6.50),
  ('marketing hub for startups',      2100, 41, NULL, 5, '/marketing-hub', 0.38, 2.10),
  ('ai content generation tool',      9800, 69, 9,  3, '/features/content-studio', 0.77, 5.30),
  ('multi-channel campaign manager',  1800, 45, 15, 8, '/features/campaigns', 0.42, 2.80),
  ('customer retention strategies',   6700, 55, 6,  2, '/blog/customer-retention', 0.58, 3.60),
  ('email automation platform',      11500, 71, 18, 8, '/features/email', 0.79, 5.90),
  ('audience segmentation tool',      3200, 48, 10, 4, '/features/audience', 0.44, 3.00),
  ('sms broadcast software',          2900, 39, 5,  2, '/features/sms', 0.36, 2.40),
  ('competitor analysis tool',        7400, 63, NULL, 6, '/features/competitor-analysis', 0.68, 4.80),
  ('answer engine optimization',      1500, 33, 22, 10, '/blog/aeo-guide', 0.29, 1.90),
  ('marketing calendar template',     4300, 44, 3,  1, '/features/calendar', 0.40, 2.20),
  ('whatsapp business api pricing',   6100, 57, 8,  3, '/pricing', 0.61, 3.90),
  ('small business marketing tools', 13500, 76, 25, 10, '/', 0.85, 7.10)
) AS v(kw, vol, diff, rank, target, url, comp, cpc)
ON CONFLICT DO NOTHING;

-- ---------- SEO audits (15) ----------
INSERT INTO mh_seo_audits (organization_id, url, audit_type, score, issues, recommendations, audit_data, created_at)
SELECT '11111111-1111-1111-1111-111111111111', v.url, v.atype, v.score, v.issues::jsonb, v.recs::jsonb, '{"seeded": true}', now() - (v.n::text || ' days')::interval
FROM (VALUES
  ('/marketing-hub',              'technical',   82, '["Missing meta description on 2 pages"]', '["Add unique meta descriptions"]', 1),
  ('/features/whatsapp-automation','content',    74, '["Thin content — under 300 words"]', '["Expand with use cases and FAQ"]', 3),
  ('/pricing',                    'performance', 91, '[]', '["Consider lazy-loading pricing table images"]', 5),
  ('/blog/customer-retention',    'content',     68, '["No internal links to related posts"]', '["Add 2-3 internal links"]', 7),
  ('/features/campaigns',         'technical',   77, '["No structured data markup"]', '["Add Product/Software schema"]', 9),
  ('/',                           'performance', 85, '["Large hero image not optimized"]', '["Compress hero image, use WebP"]', 11),
  ('/features/content-studio',    'backlinks',   58, '["Only 3 referring domains"]', '["Outreach to 5 more SaaS review sites"]', 13),
  ('/features/audience',          'content',     72, '["Missing H2 structure"]', '["Add clear H2 sections per feature"]', 15),
  ('/blog/aeo-guide',             'technical',   88, '[]', '["Add FAQ schema for featured snippet"]', 17),
  ('/features/sms',               'content',     65, '["Duplicate title tag with /features/email"]', '["Write unique title/meta"]', 19),
  ('/features/email',             'performance', 79, '["Render-blocking CSS"]', '["Defer non-critical CSS"]', 21),
  ('/features/competitor-analysis','technical',  81, '["No canonical tag"]', '["Add self-referencing canonical"]', 23),
  ('/features/calendar',          'content',     70, '["Low word count"]', '["Expand feature description"]', 25),
  ('/blog/best-crm-small-teams',  'backlinks',   62, '["Few external links out"]', '["Link to 2-3 authoritative sources"]', 27),
  ('/product/lead-generation',    'performance', 87, '["Unminified JS bundle"]', '["Enable minification in build"]', 29)
) AS v(url, atype, score, issues, recs, n)
ON CONFLICT DO NOTHING;

-- ---------- AEO optimizations (15) ----------
INSERT INTO mh_aeo_optimization (organization_id, query, answer_type, current_content, optimized_content, optimization_tips, performance, status)
SELECT '11111111-1111-1111-1111-111111111111', v.q, v.atype, v.current, v.optimized, v.tips::jsonb, '{"generated_by": "seed"}'::jsonb, v.status
FROM (VALUES
  ('what is the best crm for small teams',        'featured_snippet', NULL, 'A good CRM for small teams is lightweight, affordable, and combines contacts, deals, and messaging in one place — look for WhatsApp/email integration and simple automation.', '["Use clear, concise language","Keep answer under 58 words"]', 'completed'),
  ('how does whatsapp marketing automation work', 'featured_snippet', NULL, 'WhatsApp marketing automation sends templated, personalized messages to opted-in contacts based on triggers like sign-up, cart abandonment, or a scheduled broadcast.', '["Structure with bullet points","Include the exact question in the answer"]', 'completed'),
  ('best time to send marketing whatsapp messages','knowledge_panel', NULL, 'Most brands see the highest read rates sending WhatsApp broadcasts between 10am-12pm and 6pm-8pm local time, avoiding early morning and late night.', '["Use structured data markup","Optimize for voice search queries"]', 'completed'),
  ('how to segment audiences for campaigns',       'featured_snippet', NULL, 'Segment audiences by behavior (trial vs paid), engagement (opened/clicked), and lifecycle stage (new lead vs churn risk) rather than demographics alone.', '["Focus on direct, factual answers"]', 'monitoring'),
  ('what is answer engine optimization',           'knowledge_panel', NULL, 'Answer Engine Optimization (AEO) is the practice of structuring content so AI systems like ChatGPT, Perplexity, and Google AI Overviews can directly cite it as an answer.', '["Include related questions and answers"]', 'completed'),
  ('sms vs whatsapp for marketing',                'featured_snippet', NULL, 'WhatsApp generally has higher engagement and richer media support; SMS has near-universal reach without requiring an app. Most brands use both for different use cases.', '["Keep answer under 58 words"]', 'completed'),
  ('how to reduce campaign failure rate',          'featured_snippet', 'Keep your contact list clean.', 'Reduce campaign failure rates by verifying phone/email formatting before send, removing hard bounces after each campaign, and warming up new sending numbers gradually.', '["Structure content with bullet points"]', 'optimizing'),
  ('local business hours for support chat',        'local_pack', NULL, 'Support Hours: Mon-Sat, 9am-7pm IST\nPhone: [Your Business Phone]\nAddress: [Your Business Address]', '["Include complete NAP","Add business hours and contact information"]', 'completed'),
  ('what is a good email open rate',               'featured_snippet', NULL, 'A good email open rate is typically 20-30% for marketing campaigns, though it varies significantly by industry and list quality.', '["Keep answer under 58 words","Include the exact question in the answer"]', 'completed'),
  ('how to write a flash sale message',            'featured_snippet', NULL, 'An effective flash sale message states the discount, the deadline, and a clear call to action in the first line — urgency and clarity beat length.', '["Use clear, concise language"]', 'monitoring'),
  ('what channels does marketing hub support',     'knowledge_panel', NULL, 'Marketing Hub supports WhatsApp, Email, SMS, Messenger, Instagram, and LinkedIn (LinkedIn campaigns only, not one-off broadcasts).', '["Focus on direct, factual answers"]', 'completed'),
  ('how often should i run a competitor analysis', 'featured_snippet', NULL, 'Run a lightweight competitor analysis monthly and a deeper one quarterly — enough to catch pricing or positioning shifts without over-indexing on noise.', '["Keep answer under 58 words"]', 'pending'),
  ('what is audience size estimate based on',      'featured_snippet', NULL, 'An audience size estimate counts real, currently opted-in contacts matching your chosen tags or filters at the moment you request it — not a cached or projected number.', '["Include the exact question in the answer"]', 'completed'),
  ('how to recover an abandoned cart',             'featured_snippet', 'Send a reminder email.', 'Recover abandoned carts with a 3-message sequence: a gentle reminder at 1 hour, a social-proof nudge at 24 hours, and a small discount at 48 hours if still unconverted.', '["Structure content with bullet points"]', 'optimizing'),
  ('what is a good whatsapp read rate',            'featured_snippet', NULL, 'WhatsApp broadcasts commonly see 70-90% read rates given high open rates on the platform — well above typical email open rates.', '["Keep answer under 58 words"]', 'completed')
) AS v(q, atype, current, optimized, tips, status)
ON CONFLICT DO NOTHING;

-- ---------- Competitors (15, fictional names to avoid attributing real
-- company data we don't have) + one analysis run each ----------
WITH new_competitors AS (
  INSERT INTO mh_competitors (organization_id, name, domain, industry, channels, tracking_keywords, is_active)
  SELECT '11111111-1111-1111-1111-111111111111', v.name, v.domain, v.industry, v.channels, v.keywords, true
  FROM (VALUES
    ('NovaCRM',        'novacrm.io',        'SaaS',        ARRAY['email','whatsapp']::text[], ARRAY['crm for small teams']::text[]),
    ('PulseMail',      'pulsemail.com',     'SaaS',        ARRAY['email']::text[],             ARRAY['email automation platform']::text[]),
    ('ChatFlow',       'chatflow.app',      'SaaS',        ARRAY['whatsapp','instagram']::text[], ARRAY['whatsapp marketing automation']::text[]),
    ('ShopCart Pro',   'shopcartpro.com',   'E-commerce',  ARRAY['email','sms']::text[],       ARRAY['cart abandonment tool']::text[]),
    ('LeadSpring',     'leadspring.io',     'SaaS',        ARRAY['email','linkedin']::text[],  ARRAY['lead generation software']::text[]),
    ('Broadcastly',    'broadcastly.com',   'SaaS',        ARRAY['sms','whatsapp']::text[],    ARRAY['sms broadcast software']::text[]),
    ('AudienceIQ',     'audienceiq.co',     'SaaS',        ARRAY['email']::text[],             ARRAY['audience segmentation tool']::text[]),
    ('RivalWatch',     'rivalwatch.io',     'SaaS',        ARRAY['email']::text[],             ARRAY['competitor analysis tool']::text[]),
    ('SnapEngage Now', 'snapengagenow.com', 'SaaS',        ARRAY['webchat']::text[],           ARRAY['live chat software']::text[]),
    ('MarketLoop',     'marketloop.app',    'SaaS',        ARRAY['email','sms']::text[],       ARRAY['marketing calendar template']::text[]),
    ('ConvertKit Rival','convertwise.com',  'SaaS',        ARRAY['email']::text[],             ARRAY['email marketing for creators']::text[]),
    ('RetainWell',     'retainwell.io',     'SaaS',        ARRAY['email','whatsapp']::text[],  ARRAY['customer retention strategies']::text[]),
    ('DealDesk',       'dealdesk.io',       'SaaS',        ARRAY['linkedin','email']::text[],  ARRAY['enterprise sales software']::text[]),
    ('StoreFront AI',  'storefrontai.com',  'E-commerce',  ARRAY['instagram','sms']::text[],   ARRAY['ai content generation tool']::text[]),
    ('QuickReply Biz', 'quickreplybiz.com', 'SaaS',        ARRAY['whatsapp']::text[],          ARRAY['whatsapp business api pricing']::text[])
  ) AS v(name, domain, industry, channels, keywords)
  ON CONFLICT DO NOTHING
  RETURNING id, name
)
INSERT INTO mh_competitor_analysis (competitor_id, analysis_type, metrics, insights, recommendations, analysis_date)
SELECT id,
  (ARRAY['seo','content','social'])[1 + (row_number() OVER (ORDER BY name)::int % 3)],
  jsonb_build_object(
    'domain_authority', 30 + (row_number() OVER (ORDER BY name)::int * 3 % 60),
    'monthly_traffic_estimate', 5000 + (row_number() OVER (ORDER BY name)::int * 1200 % 40000),
    'social_followers', 800 + (row_number() OVER (ORDER BY name)::int * 400 % 15000)
  ),
  jsonb_build_object('summary', 'Simulated snapshot — connect a real SEO/social data provider under Settings → Integrations for live metrics.'),
  ARRAY['Track their top 3 keywords monthly', 'Compare content cadence quarterly'],
  now() - (row_number() OVER (ORDER BY name)::text || ' days')::interval
FROM new_competitors;

-- ---------- Calendar events (15) — some linked to real campaigns above ----------
INSERT INTO mh_calendar_events (organization_id, title, description, event_type, start_date, end_date, all_day, campaign_id, status)
SELECT '11111111-1111-1111-1111-111111111111', v.title, v.description, v.etype,
       (CURRENT_DATE + (v.day_offset::text || ' days')::interval)::timestamptz,
       CASE WHEN v.all_day THEN NULL ELSE (CURRENT_DATE + (v.day_offset::text || ' days')::interval + interval '1 hour')::timestamptz END,
       v.all_day,
       (SELECT id FROM mh_campaigns WHERE organization_id='11111111-1111-1111-1111-111111111111' AND name=v.campaign_name LIMIT 1),
       v.status
FROM (VALUES
  ('Diwali Flash Sale — Launch',    'Campaign goes live at 9am',            'campaign', -12, false, 'Diwali Flash Sale',        'completed'),
  ('Enterprise Webinar',            'Live webinar, Zoom link in calendar',  'meeting',  3,  false, 'Enterprise Webinar Invite', 'scheduled'),
  ('SMB Launch — Content Deadline', 'All creative assets due',              'deadline', 2,  true,  'SMB Product Launch',       'in_progress'),
  ('Win-Back Email Send',           'Send win-back sequence part 1',        'campaign', -18, false, 'Win-Back Churned Users',   'completed'),
  ('Weekend Deals Broadcast',       'SMS broadcast at 8am Saturday',        'broadcast', 5,  false, 'Weekend Deals',            'scheduled'),
  ('Content Studio — Blog Review',  'Review Q3 blog calendar with team',    'meeting',  1,  false, NULL,                       'scheduled'),
  ('LinkedIn Campaign Kickoff',     'Enterprise push goes live',            'campaign', 7,  false, 'LinkedIn Enterprise Push', 'scheduled'),
  ('Maintenance Window',            'Scheduled downtime notice',            'deadline', 6,  false, 'Maintenance Notice',       'scheduled'),
  ('VIP Early Access Broadcast',    'Send to VIP audience only',            'broadcast', -6, false, 'VIP Early Access',        'completed'),
  ('Monthly SEO Audit',             'Run technical audit on top 5 pages',   'deadline', 4,  true,  NULL,                       'scheduled'),
  ('Product Launch Retro',          'Team retro on SMB launch performance', 'meeting',  16, false, 'SMB Product Launch',       'scheduled'),
  ('Webinar Follow-up Email',       'Send recording + slides',              'campaign', -10, false, 'Webinar Follow-up',       'completed'),
  ('Q3 Reactivation Review',        'Check drip performance mid-cycle',     'meeting',  -3, false, 'Q3 Reactivation Drip',     'completed'),
  ('New Feature Announcement',      'Broadcast to newsletter list',         'broadcast', -9, false, 'New Feature Announcement','completed'),
  ('Instagram Retarget — Pause Review','Decide whether to resume spend',    'deadline', 0,  true,  'Instagram Retargeting',    'in_progress')
) AS v(title, description, etype, day_offset, all_day, campaign_name, status)
ON CONFLICT DO NOTHING;

-- ---------- Knowledge base articles (15) ----------
INSERT INTO mh_knowledge_articles (organization_id, title, content, category, tags, author_id, status, view_count, helpful_count)
SELECT '11111111-1111-1111-1111-111111111111', v.title, v.content, v.category, v.tags,
       (SELECT id FROM users WHERE email='admin@electrobtech.com'), v.status, v.views, v.helpful
FROM (VALUES
  ('How to launch your first WhatsApp campaign', 'Step 1: Build an audience from real contact tags. Step 2: Write your message. Step 3: Review and launch. Delivery status updates live as recipients are reached.', 'Getting Started', ARRAY['whatsapp','campaigns']::text[], 'published', 340, 28),
  ('Understanding audience tag filters',         'Audiences are built from tags on your contacts. Selecting multiple tags includes anyone with ANY of the tags — this is an OR match, not AND.', 'Audiences', ARRAY['audience','tags']::text[], 'published', 210, 19),
  ('Reading your campaign delivery funnel',      'Sent → Delivered → Read → Replied is the standard funnel. A big drop between Sent and Delivered usually means bad contact data, not a bad message.', 'Analytics', ARRAY['campaigns','analytics']::text[], 'published', 180, 15),
  ('Setting up Sandbox Mode',                    'Sandbox Mode simulates delivery so you can test the full campaign flow before connecting a real WhatsApp/Email provider. Toggle it in Settings → General.', 'Settings', ARRAY['sandbox','settings']::text[], 'published', 95, 11),
  ('Writing effective flash sale copy',          'Lead with the discount and the deadline in the first line. State the CTA clearly. Keep it under 3 short sentences for WhatsApp/SMS.', 'Content', ARRAY['copywriting','sales']::text[], 'published', 156, 22),
  ('Connecting a real WhatsApp Business API key','Head to Settings → Integrations and connect your WhatsApp Business API credentials. Until connected, sends are simulated in Sandbox Mode.', 'Integrations', ARRAY['whatsapp','integrations']::text[], 'published', 88, 9),
  ('Using AI Optimize on underperforming campaigns','AI Optimize reads your campaign''s real metrics (fail rate, read rate, reply rate) and suggests concrete next steps — it never invents numbers not in your data.', 'AI Features', ARRAY['ai','campaigns']::text[], 'published', 122, 17),
  ('Content Studio: generating on-brand copy',   'Pick a campaign type, industry, and goal, then Generate — this calls a real LLM, not a template. Save anything you like to your content library.', 'Content', ARRAY['ai','content-studio']::text[], 'published', 145, 20),
  ('Difference between Campaigns and Broadcasts','Campaigns support budgets, objectives, and every channel including LinkedIn. Broadcasts are simpler one-shot sends and don''t support LinkedIn.', 'Getting Started', ARRAY['campaigns','broadcasts']::text[], 'published', 201, 24),
  ('SEO keyword tracking basics',                'Add keywords you want to rank for; volume/difficulty/rank data refreshes as you run audits. Set a target rank to track progress toward a goal.', 'SEO', ARRAY['seo']::text[], 'published', 74, 8),
  ('What Answer Engine Optimization (AEO) means for you','AI answer engines like ChatGPT and Perplexity increasingly answer questions directly instead of linking out. AEO structures your content so they can cite it.', 'SEO', ARRAY['aeo','seo']::text[], 'published', 68, 7),
  ('Running a competitor analysis',              'Add a competitor by domain, then run a SEO/content/social analysis. Metrics are simulated until you connect a real data provider — treat them as directional, not exact.', 'Competitive Intel', ARRAY['competitors']::text[], 'published', 59, 6),
  ('Exporting campaign data',                    'Use the Export button on Campaigns or Broadcasts to download a CSV of everything currently in the table (or just your selected rows).', 'Reporting', ARRAY['export','campaigns']::text[], 'published', 47, 5),
  ('Marketing Calendar overview',                'The calendar shows campaigns, broadcasts, content deadlines, and meetings in one view. Click any day to see what''s scheduled.', 'Getting Started', ARRAY['calendar']::text[], 'draft', 12, 1),
  ('Troubleshooting failed sends',                'A high failed_count usually means bad phone/email formatting or an unreachable recipient. Refresh the audience and re-verify contact data before resending.', 'Troubleshooting', ARRAY['campaigns','troubleshooting']::text[], 'published', 133, 18)
) AS v(title, content, category, tags, status, views, helpful)
ON CONFLICT DO NOTHING;

-- ---------- Settings defaults (General/Notifications/AI Config/Sandbox) —
-- not a "15 rows" tab like the others, just sane out-of-the-box values so
-- the Settings page never renders blank inputs. ----------
INSERT INTO mh_settings (organization_id, category, key, value, description, is_public) VALUES
  ('11111111-1111-1111-1111-111111111111', 'sandbox',       'enabled',        'true',                     'Simulate delivery instead of calling real provider APIs', true),
  ('11111111-1111-1111-1111-111111111111', 'general',       'timezone',       '"Asia/Kolkata"',           'Default workspace timezone', true),
  ('11111111-1111-1111-1111-111111111111', 'general',       'language',       '"en"',                     'Default workspace language', true),
  ('11111111-1111-1111-1111-111111111111', 'general',       'date_format',    '"DD/MM/YYYY"',             'Default date display format', true),
  ('11111111-1111-1111-1111-111111111111', 'general',       'currency',       '"INR"',                    'Default currency for budgets/reports', true),
  ('11111111-1111-1111-1111-111111111111', 'notifications', 'campaign_complete', 'true',                  'Notify when a campaign finishes sending', true),
  ('11111111-1111-1111-1111-111111111111', 'notifications', 'high_failure_rate', 'true',                  'Notify if a campaign''s failure rate exceeds 15%', true),
  ('11111111-1111-1111-1111-111111111111', 'notifications', 'weekly_digest',  'false',                    'Send a weekly performance digest email', true),
  ('11111111-1111-1111-1111-111111111111', 'ai_config',      'default_tone',  '"friendly"',               'Default tone for AI-generated content', true),
  ('11111111-1111-1111-1111-111111111111', 'ai_config',      'auto_optimize', 'false',                    'Automatically suggest AI Optimize on underperforming campaigns', true)
ON CONFLICT (organization_id, category, key) DO NOTHING;

-- ---------- Integrations (15) — mirrors the "WhatsApp: not connected"
-- honesty pattern: only Groq (the LLM you actually have a key for) starts
-- active, everything else starts inactive until real credentials are added
-- via Settings → Integrations. ----------
INSERT INTO mh_integrations (organization_id, provider, service_type, credentials, configuration, status)
SELECT '11111111-1111-1111-1111-111111111111', v.provider, v.stype, v.creds::jsonb, '{}', v.status
FROM (VALUES
  ('groq_llm',               'analytics', '{"note": "uses GROQ_API_KEY from environment, not stored here"}', 'active'),
  ('whatsapp_business_api',  'social',    '{}', 'inactive'),
  ('meta_ads',               'social',    '{}', 'inactive'),
  ('google_analytics',       'analytics', '{}', 'inactive'),
  ('google_search_console',  'seo',       '{}', 'inactive'),
  ('semrush',                'seo',       '{}', 'inactive'),
  ('ahrefs',                 'seo',       '{}', 'inactive'),
  ('mailchimp',              'email',     '{}', 'inactive'),
  ('sendgrid',               'email',     '{}', 'inactive'),
  ('hubspot',                'crm',       '{}', 'inactive'),
  ('salesforce',             'crm',       '{}', 'inactive'),
  ('twilio_sms',             'social',    '{}', 'inactive'),
  ('linkedin_ads',           'social',    '{}', 'inactive'),
  ('cloudinary',             'storage',   '{}', 'inactive'),
  ('aws_s3',                 'storage',   '{}', 'inactive')
) AS v(provider, stype, creds, status)
ON CONFLICT DO NOTHING;
