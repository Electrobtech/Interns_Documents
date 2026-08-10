-- =====================================================================
-- Marketing Hub Seed Data for Electrobtech Innovations
-- Statuses aligned with the mh_campaigns_status_check constraint:
--   draft | scheduled | queued | processing | completed | failed | paused | archived
-- =====================================================================

-- ---------- Marketing Hub Campaigns (24 records) ----------
INSERT INTO mh_campaigns (organization_id, kind, name, channel, audience_id, message_body, status, sent_count, delivered_count, read_count, replied_count, failed_count)
SELECT
  (SELECT id FROM organizations LIMIT 1),
  v.kind,
  v.name,
  v.channel,
  NULL,
  v.message_body,
  v.status,
  v.sent_count,
  v.delivered_count,
  v.read_count,
  v.replied_count,
  v.failed_count
FROM (VALUES
  ('campaign', 'Diwali Flash Sale - AI Courses',    'whatsapp',  '🔥 Diwali Special! Get 40% off on all AI/ML courses. Limited time offer - enroll now!',                                                                       'completed',  450,  432, 287, 23, 18),
  ('campaign', 'New Year Learning Resolution',       'email',     'Start 2025 with new skills! 🚀 Our Full Stack Development course is now open. Early bird discount available.',                                               'processing', 1200, 1150, 680, 45, 50),
  ('campaign', 'Embedded Systems Workshop Promo',   'instagram', '🎓 Learn to build smart devices! Our Embedded Systems workshop starts next week. Limited seats. DM to register!',                                          'draft',      0,    0,   0,  0,  0),
  ('campaign', 'Data Science Career Webinar',        'email',     '📊 Free Webinar: Data Science Career Paths in 2025. Join our experts this Saturday. Register now!',                                                       'draft',      0,    0,   0,  0,  0),
  ('campaign', 'Corporate Training B2B Outreach',    'linkedin',  '🏢 Upskill your team with our corporate training programs. AI/ML, Data Science, Cloud Computing. Custom solutions available.',                            'processing', 150,  145,  95, 12,  5),
  ('campaign', 'Summer Internship Drive',            'whatsapp',  '🎯 Summer Internship Program 2025! Work on real projects. AI, Data Science, Web Development. Apply by March 31st!',                                       'draft',      0,    0,   0,  0,  0),
  ('campaign', 'Python for Beginners Push',          'sms',       'Learn Python from scratch! New batch starting next week. Call 9876543210 to enroll.',                                                                     'completed',  800,  760, 410, 34, 40),
  ('campaign', 'Placement Success Stories',          'email',     '🎉 Congratulations to our students placed at top companies! Read their success stories. Get inspired and start your journey today.',                       'processing', 950,  920, 540, 28, 30),
  ('campaign', 'Black Friday Course Bundle',         'whatsapp',  '🛒 Black Friday Deal! Buy 2 courses, get 1 FREE. AI + Data Science + Full Stack. Limited time offer!',                                                    'scheduled',  0,    0,   0,  0,  0),
  ('campaign', 'AI Ethics Discussion Series',        'instagram', '🤖 Join our AI Ethics discussion series. Explore responsible AI development. Every Thursday at 7 PM. Free to attend!',                                   'processing', 0,    0,   0,  0,  0),
  ('broadcast', 'Exam Results Announcement',         'whatsapp',  '📢 Exam Results Announced! Check your portal for results. Congratulations to all successful candidates!',                                                  'completed',  320,  310, 245, 18, 10),
  ('broadcast', 'Holiday Schedule Notice',           'email',     '📅 Holiday Schedule: Our center will be closed from Dec 25th to Jan 1st. Online courses will continue as normal. Happy Holidays!',                        'draft',      0,    0,   0,  0,  0),
  ('campaign', 'Machine Learning Specialization',    'linkedin',  '🧠 Master Machine Learning with our 12-week specialization. Hands-on projects, industry mentorship. Next batch: Jan 15th.',                               'draft',      0,    0,   0,  0,  0),
  ('campaign', 'React Native Bootcamp',              'whatsapp',  '📱 Build mobile apps with React Native! 4-week intensive bootcamp. Project-based learning. Limited seats!',                                               'processing', 280,  265, 158, 19, 15),
  ('campaign', 'Cloud Computing Certification',      'email',     '☁️ Become AWS Certified! Our Cloud Computing course includes exam prep. 95% pass rate. Enroll now!',                                                     'completed',  780,  755, 468, 38, 25),
  ('broadcast', 'New Course Launch Alert',           'sms',       'New Course: DevOps Engineering! Launch offer: 30% off. Visit electrobtech.com for details.',                                                              'completed',  950,  890, 545, 42, 60),
  ('campaign', 'Women in Tech Scholarship',          'instagram', '💪 Women in Tech Scholarship Program! 50% scholarship for female candidates in all courses. Apply now!',                                                  'processing', 0,    0,   0,  0,  0),
  ('campaign', 'Advanced React Workshop',            'email',     '⚛️ Advanced React Workshop: Hooks, Context, Performance Optimization. Weekend batch.',                                                                     'draft',      0,    0,   0,  0,  0),
  ('campaign', 'Cybersecurity Basics',               'whatsapp',  '🔒 Cybersecurity Basics Course! Learn network security, ethical hacking, and data protection. 6-week program.',                                          'scheduled',  0,    0,   0,  0,  0),
  ('campaign', 'Spring Boot Workshop',               'email',     '☕ Master Spring Boot! Build enterprise Java applications. 8-week intensive program with real projects.',                                                  'draft',      0,    0,   0,  0,  0),
  ('campaign', 'Flutter Mobile Development',         'whatsapp',  '📱 Flutter Masterclass! Build cross-platform mobile apps. 10-week program with certification.',                                                           'processing', 350,  330, 180, 22, 18),
  ('broadcast', 'Weekend Batch Reminder',            'sms',       '📅 Reminder: Weekend batch starts this Saturday! Confirm your slot by replying YES.',                                                                      'completed',  420,  400, 280, 35, 25),
  ('campaign', 'Data Analytics with Python',         'email',     '📊 Data Analytics with Python! Learn pandas, numpy, matplotlib. 6-week practical course.',                                                               'completed',  560,  540, 320, 28, 32),
  ('campaign', 'Kubernetes Orchestration',           'linkedin',  '☸️ Kubernetes Deep Dive! Container orchestration mastery. 4-week advanced course.',                                                                       'draft',      0,    0,   0,  0,  0)
) AS v(kind, name, channel, message_body, status, sent_count, delivered_count, read_count, replied_count, failed_count)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Audiences (23 records) ----------
INSERT INTO mh_audiences (organization_id, name, filter, size_cached)
SELECT
  (SELECT id FROM organizations LIMIT 1),
  v.name,
  v.filter::jsonb,
  v.size_cached
FROM (VALUES
  ('Engineering Students',      '{"tags": ["student", "engineering"], "course_interest": ["ai", "ml", "data_science"]}',  450),
  ('Working Professionals',     '{"tags": ["professional"], "experience_years": {"min": 1}}',                              320),
  ('Corporate Clients',         '{"tags": ["corporate", "b2b"], "company_size": {"min": 50}}',                             85),
  ('Recent Graduates',          '{"tags": ["graduate"], "graduation_year": {"min": 2023}}',                                280),
  ('Data Science Enthusiasts',  '{"tags": ["data_science"], "skill_level": ["beginner", "intermediate"]}',                 195),
  ('Web Development Beginners', '{"tags": ["web_dev"], "course_interest": ["react", "nodejs", "fullstack"]}',              340),
  ('AI/ML Learners',            '{"tags": ["ai", "ml"], "skill_level": ["intermediate", "advanced"]}',                    165),
  ('Mobile App Developers',     '{"tags": ["mobile", "app_dev"], "course_interest": ["react_native", "flutter"]}',        110),
  ('Cloud Computing Students',  '{"tags": ["cloud", "aws", "azure"], "certification_goal": true}',                        145),
  ('Cybersecurity Interested',  '{"tags": ["security", "cybersecurity"], "skill_level": ["beginner"]}',                   95),
  ('DevOps Engineers',          '{"tags": ["devops", "ci_cd"], "experience_years": {"min": 2}}',                          75),
  ('Python Developers',         '{"tags": ["python"], "skill_level": ["intermediate"]}',                                   220),
  ('JavaScript Developers',     '{"tags": ["javascript", "react", "nodejs"]}',                                            310),
  ('Full Stack Developers',     '{"tags": ["fullstack", "mern", "mean"]}',                                                185),
  ('Business Analysts',         '{"tags": ["business", "analytics"], "experience_years": {"min": 1}}',                   65),
  ('Startup Founders',          '{"tags": ["startup", "founder"], "company_size": {"max": 10}}',                          35),
  ('Government Employees',      '{"tags": ["government", "public_sector"]}',                                              45),
  ('Academic Institutions',     '{"tags": ["academic", "university", "college"]}',                                        28),
  ('Java Developers',           '{"tags": ["java", "spring", "springboot"], "skill_level": ["intermediate"]}',            180),
  ('Blockchain Enthusiasts',    '{"tags": ["blockchain", "web3", "crypto"], "skill_level": ["beginner"]}',                55),
  ('IoT Developers',            '{"tags": ["iot", "embedded", "hardware"], "course_interest": ["embedded_systems"]}',     70),
  ('Game Developers',           '{"tags": ["gaming", "unity", "unreal"], "skill_level": ["intermediate"]}',               40),
  ('UI/UX Designers',           '{"tags": ["design", "ui", "ux"], "skill_level": ["beginner", "intermediate"]}',          125)
) AS v(name, filter, size_cached)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Recipients ----------
-- Uses correct column names per schema: channel, error (not error_message).
-- Simple single-campaign insert to avoid (campaign_id, destination) unique conflict.
DO $$
DECLARE
  v_campaign_id UUID;
  v_channel TEXT;
BEGIN
  SELECT id, channel INTO v_campaign_id, v_channel
  FROM mh_campaigns WHERE status = 'completed' LIMIT 1;

  IF v_campaign_id IS NOT NULL THEN
    INSERT INTO mh_recipients (campaign_id, channel, destination, status, attempts, job_id, provider_message_id)
    VALUES
      (v_campaign_id, v_channel, '+919000000001', 'delivered', 1, 'job_001', 'msg_100'),
      (v_campaign_id, v_channel, '+919000000002', 'read',      1, 'job_002', 'msg_101'),
      (v_campaign_id, v_channel, '+919000000003', 'replied',   1, 'job_003', 'msg_102'),
      (v_campaign_id, v_channel, '+919000000004', 'sent',      1, 'job_004', 'msg_103'),
      (v_campaign_id, v_channel, '+919000000005', 'failed',    2, 'job_005', NULL)
    ON CONFLICT DO NOTHING;

    -- Delivery events for those recipients
    INSERT INTO mh_delivery_events (recipient_id, campaign_id, event_type, payload)
    SELECT r.id, r.campaign_id, v.event_type, v.payload::jsonb
    FROM mh_recipients r
    CROSS JOIN (VALUES
      ('sent',      '{"provider":"meta"}'),
      ('delivered', '{"provider":"meta","ts":"2025-01-15T10:30:00Z"}')
    ) AS v(event_type, payload)
    WHERE r.campaign_id = v_campaign_id
      AND r.status IN ('delivered','read','replied')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

