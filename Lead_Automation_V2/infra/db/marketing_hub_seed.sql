-- =====================================================================
-- Marketing Hub Seed Data for Electrobtech Innovations
-- Updated to match actual database schema
-- =====================================================================

-- ---------- Marketing Hub Campaigns (20 records) ----------
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
  ('campaign', 'Diwali Flash Sale - AI Courses', 'whatsapp', '🔥 Diwali Special! Get 40% off on all AI/ML courses. Limited time offer - enroll now! [Link]', 'sent', 450, 432, 287, 23, 18),
  ('campaign', 'New Year Learning Resolution', 'email', 'Start 2025 with new skills! 🚀 Our comprehensive Full Stack Development course is now open for enrollment. Early bird discount available.', 'sending', 1200, 1150, 680, 45, 50),
  ('campaign', 'Embedded Systems Workshop Promo', 'instagram', '🎓 Learn to build smart devices! Our Embedded Systems workshop starts next week. Limited seats. DM to register!', 'draft', 0, 0, 0, 0, 0),
  ('campaign', 'Data Science Career Webinar', 'email', '📊 Free Webinar: Data Science Career Paths in 2025. Join our experts this Saturday. Register now!', 'draft', 0, 0, 0, 0, 0),
  ('campaign', 'Corporate Training B2B Outreach', 'linkedin', '🏢 Upskill your team with our corporate training programs. AI/ML, Data Science, Cloud Computing. Custom solutions available.', 'sending', 150, 145, 95, 12, 5),
  ('campaign', 'Summer Internship Drive', 'whatsapp', '🎯 Summer Internship Program 2025! Work on real projects. AI, Data Science, Web Development. Apply by March 31st!', 'draft', 0, 0, 0, 0, 0),
  ('campaign', 'Python for Beginners Push', 'sms', 'Learn Python from scratch! New batch starting next week. Call 9876543210 to enroll.', 'sent', 800, 760, 410, 34, 40),
  ('campaign', 'Placement Success Stories', 'email', '🎉 Congratulations to our students placed at top companies! Read their success stories. Get inspired and start your journey today.', 'sending', 950, 920, 540, 28, 30),
  ('campaign', 'Black Friday Course Bundle', 'whatsapp', '🛒 Black Friday Deal! Buy 2 courses, get 1 FREE. AI + Data Science + Full Stack. Limited time offer!', 'scheduled', 0, 0, 0, 0, 0),
  ('campaign', 'AI Ethics Discussion Series', 'instagram', '🤖 Join our AI Ethics discussion series. Explore responsible AI development. Every Thursday at 7 PM. Free to attend!', 'sending', 0, 0, 0, 0, 0),
  ('broadcast', 'Exam Results Announcement', 'whatsapp', '📢 Exam Results Announced! Check your portal for results. Congratulations to all successful candidates!', 'sent', 320, 310, 245, 18, 10),
  ('broadcast', 'Holiday Schedule Notice', 'email', '📅 Holiday Schedule: Our center will be closed from Dec 25th to Jan 1st. Online courses will continue as normal. Happy Holidays!', 'draft', 0, 0, 0, 0, 0),
  ('campaign', 'Machine Learning Specialization', 'linkedin', '🧠 Master Machine Learning with our 12-week specialization. Hands-on projects, industry mentorship. Next batch: Jan 15th.', 'draft', 0, 0, 0, 0, 0),
  ('campaign', 'React Native Bootcamp', 'whatsapp', '📱 Build mobile apps with React Native! 4-week intensive bootcamp. Project-based learning. Limited seats!', 'sending', 280, 265, 158, 19, 15),
  ('campaign', 'Cloud Computing Certification', 'email', '☁️ Become AWS Certified! Our Cloud Computing course includes exam prep. 95% pass rate. Enroll now!', 'sent', 780, 755, 468, 38, 25),
  ('broadcast', 'New Course Launch Alert', 'sms', 'New Course: DevOps Engineering! Launch offer: 30% off. Visit electrobtech.com for details.', 'sent', 950, 890, 545, 42, 60),
  ('campaign', 'Women in Tech Scholarship', 'instagram', '💪 Women in Tech Scholarship Program! 50% scholarship for female candidates in all courses. Apply now!', 'sending', 0, 0, 0, 0, 0),
  ('campaign', 'Advanced React Workshop', 'email', '⚛️ Advanced React Workshop: Hooks, Context, Performance Optimization. Weekend batch. Prerequisites: Basic React knowledge.', 'draft', 0, 0, 0, 0, 0),
  ('campaign', 'Cybersecurity Basics', 'whatsapp', '🔒 Cybersecurity Basics Course! Learn network security, ethical hacking, and data protection. 6-week program.', 'scheduled', 0, 0, 0, 0, 0)
) AS v(kind, name, channel, message_body, status, sent_count, delivered_count, read_count, replied_count, failed_count)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Audiences (18 records) ----------
INSERT INTO mh_audiences (organization_id, name, filter, size_cached)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  v.name,
  v.filter::jsonb,
  v.size_cached
FROM (VALUES
  ('Engineering Students', '{"tags": ["student", "engineering"], "course_interest": ["ai", "ml", "data_science"]}', 450),
  ('Working Professionals', '{"tags": ["professional"], "experience_years": {"min": 1}}', 320),
  ('Corporate Clients', '{"tags": ["corporate", "b2b"], "company_size": {"min": 50}}', 85),
  ('Recent Graduates', '{"tags": ["graduate"], "graduation_year": {"min": 2023}}', 280),
  ('Data Science Enthusiasts', '{"tags": ["data_science"], "skill_level": ["beginner", "intermediate"]}', 195),
  ('Web Development Beginners', '{"tags": ["web_dev"], "course_interest": ["react", "nodejs", "fullstack"]}', 340),
  ('AI/ML Learners', '{"tags": ["ai", "ml"], "skill_level": ["intermediate", "advanced"]}', 165),
  ('Mobile App Developers', '{"tags": ["mobile", "app_dev"], "course_interest": ["react_native", "flutter"]}', 110),
  ('Cloud Computing Students', '{"tags": ["cloud", "aws", "azure"], "certification_goal": true}', 145),
  ('Cybersecurity Interested', '{"tags": ["security", "cybersecurity"], "skill_level": ["beginner"]}', 95),
  ('DevOps Engineers', '{"tags": ["devops", "ci_cd"], "experience_years": {"min": 2}}', 75),
  ('Python Developers', '{"tags": ["python"], "skill_level": ["intermediate"]}', 220),
  ('JavaScript Developers', '{"tags": ["javascript", "react", "nodejs"]}', 310),
  ('Full Stack Developers', '{"tags": ["fullstack", "mern", "mean"]}', 185),
  ('Business Analysts', '{"tags": ["business", "analytics"], "experience_years": {"min": 1}}', 65),
  ('Startup Founders', '{"tags": ["startup", "founder"], "company_size": {"max": 10}}', 35),
  ('Government Employees', '{"tags": ["government", "public_sector"]}', 45),
  ('Academic Institutions', '{"tags": ["academic", "university", "college"]}', 28)
) AS v(name, filter, size_cached)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Recipients (50 records) ----------
INSERT INTO mh_recipients (campaign_id, contact_id, destination, status, attempts, job_id, provider_message_id, error_message, last_attempted_at)
SELECT 
  c.id,
  ct.id,
  ct.phone,
  v.status,
  v.attempts,
  v.job_id,
  v.provider_message_id,
  v.error_message,
  CASE WHEN v.attempts > 0 THEN now() - (v.last_attempted_mins || ' minutes')::interval ELSE NULL END
FROM (SELECT id FROM mh_campaigns WHERE status IN ('sent', 'sending', 'completed') LIMIT 5) c
CROSS JOIN (SELECT id, phone FROM contacts WHERE organization_id = '11111111-1111-1111-1111-111111111111' LIMIT 8) ct
CROSS JOIN (VALUES
  ('sent', 1, 'job_001', 'msg_123', NULL, 5),
  ('delivered', 1, 'job_002', 'msg_124', NULL, 8),
  ('read', 1, 'job_003', 'msg_125', NULL, 12),
  ('replied', 1, 'job_004', 'msg_126', NULL, 15),
  ('failed', 2, 'job_005', NULL, 'Invalid phone number', 3),
  ('queued', 0, NULL, NULL, NULL, NULL)
) AS v(status, attempts, job_id, provider_message_id, error_message, last_attempted_mins)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Delivery Events (100 records) ----------
INSERT INTO mh_delivery_events (recipient_id, event_type, provider_data)
SELECT 
  r.id,
  v.event_type,
  v.provider_data::jsonb
FROM mh_recipients r
CROSS JOIN (VALUES
  ('sent', '{"attempt":1,"provider":"meta","message_id":"msg_123"}'),
  ('delivered', '{"attempt":1,"provider":"meta","message_id":"msg_123","delivered_to":"+919000000001"}'),
  ('read', '{"attempt":1,"provider":"meta","message_id":"msg_123","read_at":"2025-01-15T10:30:00Z"}'),
  ('replied', '{"attempt":1,"provider":"meta","message_id":"msg_123","reply":"Yes, interested!"}'),
  ('failed', '{"attempt":1,"provider":"meta","error":"Invalid phone number"}')
) AS v(event_type, provider_data)
WHERE r.status IN ('sent','delivered','read','replied','failed')
ON CONFLICT DO NOTHING;
