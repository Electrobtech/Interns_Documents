-- =====================================================================
-- Marketing Hub Seed Data for Electrobtech Innovations
-- Adds realistic demo data for all Marketing Hub tables (15+ records each)
-- =====================================================================

-- ---------- Marketing Hub Campaigns (20 records) ----------
INSERT INTO mh_campaigns (organization_id, kind, name, channel, objective, audience_id, message_body, budget_amount, start_date, end_date, scheduled_at, status, total_recipients, metrics, created_by) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Diwali Flash Sale - AI Courses', 'whatsapp', 'Sales', NULL, '🔥 Diwali Special! Get 40% off on all AI/ML courses. Limited time offer - enroll now! [Link]', 15000, '2024-10-20', '2024-10-25', '2024-10-20 09:00:00', 'completed', 450, '{"sent":450,"delivered":432,"read":287,"clicked":89,"replied":23,"failed":18}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'New Year Learning Resolution', 'email', 'Lead Generation', NULL, 'Start 2025 with new skills! 🚀 Our comprehensive Full Stack Development course is now open for enrollment. Early bird discount available.', 25000, '2024-12-28', '2025-01-15', '2024-12-28 10:00:00', 'processing', 1200, '{"sent":1200,"delivered":1150,"read":680,"clicked":210,"replied":45,"failed":50}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Embedded Systems Workshop Promo', 'instagram', 'Brand Awareness', NULL, '🎓 Learn to build smart devices! Our Embedded Systems workshop starts next week. Limited seats. DM to register!', 8000, '2024-11-01', '2024-11-15', '2024-11-01 11:00:00', 'scheduled', 0, '{}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Data Science Career Webinar', 'email', 'Webinar', NULL, '📊 Free Webinar: Data Science Career Paths in 2025. Join our experts this Saturday. Register now!', 5000, '2024-11-10', '2024-11-10', '2024-11-10 15:00:00', 'draft', 0, '{}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Corporate Training B2B Outreach', 'linkedin', 'Lead Generation', NULL, '🏢 Upskill your team with our corporate training programs. AI/ML, Data Science, Cloud Computing. Custom solutions available.', 30000, '2024-11-05', '2024-11-30', '2024-11-05 09:30:00', 'processing', 150, '{"sent":150,"delivered":145,"read":95,"clicked":32,"replied":12,"failed":5}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Summer Internship Drive', 'whatsapp', 'Event Registration', NULL, '🎯 Summer Internship Program 2025! Work on real projects. AI, Data Science, Web Development. Apply by March 31st!', 12000, '2025-02-15', '2025-03-31', '2025-02-15 10:00:00', 'draft', 0, '{}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Python for Beginners Push', 'sms', 'Conversion', NULL, 'Learn Python from scratch! New batch starting next week. Call 9876543210 to enroll.', 3000, '2024-11-20', '2024-11-27', '2024-11-20 12:00:00', 'completed', 800, '{"sent":800,"delivered":760,"read":410,"clicked":85,"replied":34,"failed":40}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Placement Success Stories', 'email', 'Engagement', NULL, '🎉 Congratulations to our students placed at top companies! Read their success stories. Get inspired and start your journey today.', 6000, '2024-11-12', '2024-11-19', '2024-11-12 14:00:00', 'processing', 950, '{"sent":950,"delivered":920,"read":540,"clicked":178,"replied":28,"failed":30}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Black Friday Course Bundle', 'whatsapp', 'Sales', NULL, '🛒 Black Friday Deal! Buy 2 courses, get 1 FREE. AI + Data Science + Full Stack. Limited time offer!', 20000, '2024-11-25', '2024-11-30', '2024-11-25 08:00:00', 'scheduled', 0, '{}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'AI Ethics Discussion Series', 'instagram', 'Engagement', NULL, '🤖 Join our AI Ethics discussion series. Explore responsible AI development. Every Thursday at 7 PM. Free to attend!', 4000, '2024-11-07', '2024-12-05', '2024-11-07 18:00:00', 'processing', 0, '{}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'broadcast', 'Exam Results Announcement', 'whatsapp', 'Engagement', NULL, '📢 Exam Results Announced! Check your portal for results. Congratulations to all successful candidates!', 2000, '2024-10-30', '2024-10-30', '2024-10-30 16:00:00', 'completed', 320, '{"sent":320,"delivered":310,"read":245,"clicked":67,"replied":18,"failed":10}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'broadcast', 'Holiday Schedule Notice', 'email', 'Information', NULL, '📅 Holiday Schedule: Our center will be closed from Dec 25th to Jan 1st. Online courses will continue as normal. Happy Holidays!', 1500, '2024-12-20', '2024-12-20', '2024-12-20 10:00:00', 'draft', 0, '{}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Machine Learning Specialization', 'linkedin', 'Sales', NULL, '🧠 Master Machine Learning with our 12-week specialization. Hands-on projects, industry mentorship. Next batch: Jan 15th.', 18000, '2025-01-05', '2025-01-25', '2025-01-05 09:00:00', 'draft', 0, '{}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'React Native Bootcamp', 'whatsapp', 'Course Registration', NULL, '📱 Build mobile apps with React Native! 4-week intensive bootcamp. Project-based learning. Limited seats!', 10000, '2024-11-18', '2024-12-15', '2024-11-18 11:00:00', 'processing', 280, '{"sent":280,"delivered":265,"read":158,"clicked":52,"replied":19,"failed":15}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Cloud Computing Certification', 'email', 'Sales', NULL, '☁️ Become AWS Certified! Our Cloud Computing course includes exam prep. 95% pass rate. Enroll now!', 16000, '2024-11-08', '2024-12-01', '2024-11-08 10:30:00', 'completed', 780, '{"sent":780,"delivered":755,"read":468,"clicked":142,"replied":38,"failed":25}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'broadcast', 'New Course Launch Alert', 'sms', 'Announcement', NULL, 'New Course: DevOps Engineering! Launch offer: 30% off. Visit electrobtech.com for details.', 2500, '2024-11-02', '2024-11-02', '2024-11-02 09:00:00', 'completed', 950, '{"sent":950,"delivered":890,"read":545,"clicked":98,"replied":42,"failed":60}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Women in Tech Scholarship', 'instagram', 'Brand Awareness', NULL, '💪 Women in Tech Scholarship Program! 50% scholarship for female candidates in all courses. Apply now!', 7000, '2024-11-15', '2024-12-15', '2024-11-15 12:00:00', 'processing', 0, '{}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Advanced React Workshop', 'email', 'Workshop', NULL, '⚛️ Advanced React Workshop: Hooks, Context, Performance Optimization. Weekend batch. Prerequisites: Basic React knowledge.', 4500, '2024-11-22', '2024-11-24', '2024-11-22 10:00:00', 'draft', 0, '{}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'campaign', 'Cybersecurity Basics', 'whatsapp', 'Lead Generation', NULL, '🔒 Cybersecurity Basics Course! Learn network security, ethical hacking, and data protection. 6-week program.', 9000, '2024-11-25', '2025-01-10', '2024-11-25 14:00:00', 'scheduled', 0, '{}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1))
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Audiences (18 records) ----------
INSERT INTO mh_audiences (organization_id, name, description, filter, size_cached, tags, created_by) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Engineering Students', 'B.Tech/B.E students interested in tech courses', '{"tags": ["student", "engineering"], "course_interest": ["ai", "ml", "data_science"]}', 450, '{"education": "engineering"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Working Professionals', 'Professionals looking for skill upgradation', '{"tags": ["professional"], "experience_years": {"min": 1}}', 320, '{"employment": "professional"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Corporate Clients', 'B2B leads for corporate training', '{"tags": ["corporate", "b2b"], "company_size": {"min": 50}}', 85, '{"business_type": "corporate"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Recent Graduates', 'Fresh graduates seeking career enhancement', '{"tags": ["graduate", "fresher"], "graduation_year": {"min": 2023}}', 180, '{"education": "graduate"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'AI/ML Enthusiasts', 'People interested in Artificial Intelligence', '{"tags": ["ai", "ml", "machine_learning"], "course_interest": ["ai", "ml"]}', 275, '{"interest": "ai_ml"}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Web Development Learners', 'Interested in Full Stack Development', '{"tags": ["web", "frontend", "backend"], "course_interest": ["full_stack", "web_dev"]}', 340, '{"interest": "web_dev"}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Data Science Aspirants', 'Looking for Data Science career', '{"tags": ["data_science", "analytics"], "course_interest": ["data_science"]}', 225, '{"interest": "data_science"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'High Intent Leads', 'Leads with high engagement scores', '{"engagement_score": {"min": 70}, "last_active_days": {"max": 30}}', 120, '{"intent": "high"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Past Students', 'Alumni for advanced courses', '{"tags": ["alumni", "past_student"], "completed_courses": {"min": 1}}', 95, '{"status": "alumni"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Weekend Learners', 'Prefer weekend batches', '{"preferences": ["weekend"], "availability": "weekend"}', 280, '{"schedule": "weekend"}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Budget Conscious', 'Looking for affordable courses', '{"budget_range": {"max": 25000}, "price_sensitivity": "high"}', 420, '{"budget": "low"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Premium Segment', 'Willing to invest in quality education', '{"budget_range": {"min": 50000}, "price_sensitivity": "low"}', 65, '{"budget": "high"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Regional Audience - South', 'Students from South India', '{"location": ["tamil_nadu", "karnataka", "kerala", "andhra"]}', 195, '{"region": "south"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Regional Audience - North', 'Students from North India', '{"location": ["delhi", "maharashtra", "gujarat", "rajasthan"]}', 175, '{"region": "north"}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Social Media Followers', 'Followers from social platforms', '{"source": ["instagram", "linkedin", "twitter"], "follower": true}', 540, '{"source": "social"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Email Subscribers', 'Newsletter subscribers', '{"subscription": ["newsletter"], "email_opt_in": true}', 680, '{"source": "email"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Workshop Attendees', 'Past workshop participants', '{"event_attendance": {"min": 1}, "event_type": "workshop"}', 155, '{"engagement": "workshop"}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)),
  ((SELECT id FROM organizations LIMIT 1), 'Inactive Leads', 'Re-engagement campaign target', '{"last_active_days": {"min": 90}, "status": "inactive"}', 310, '{"status": "inactive"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1))
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Recipients (sample data for campaigns) ----------
INSERT INTO mh_recipients (campaign_id, contact_id, channel, destination, display_name, rendered_message, status, sent_at, delivered_at, read_at, clicked_at, replied_at, failed_reason) VALUES
  -- Diwali Flash Sale recipients
  ((SELECT id FROM mh_campaigns WHERE name='Diwali Flash Sale - AI Courses' LIMIT 1), 
   (SELECT id FROM contacts WHERE email='rohan@example.com' LIMIT 1), 'whatsapp', '919000000001', 'Rohan Verma', 
   '🔥 Diwali Special! Get 40% off on all AI/ML courses. Limited time offer - enroll now! [Link]', 
   'delivered', '2024-10-20 09:05:00', '2024-10-20 09:06:00', '2024-10-20 09:15:00', '2024-10-20 09:18:00', '2024-10-20 09:25:00', NULL),
  ((SELECT id FROM mh_campaigns WHERE name='Diwali Flash Sale - AI Courses' LIMIT 1), 
   (SELECT id FROM contacts WHERE email='ananya@example.com' LIMIT 1), 'whatsapp', '919000000002', 'Ananya Singh', 
   '🔥 Diwali Special! Get 40% off on all AI/ML courses. Limited time offer - enroll now! [Link]', 
   'read', '2024-10-20 09:05:00', '2024-10-20 09:07:00', '2024-10-20 09:20:00', NULL, NULL, NULL),
  ((SELECT id FROM mh_campaigns WHERE name='Diwali Flash Sale - AI Courses' LIMIT 1), 
   (SELECT id FROM contacts WHERE email='neha@example.com' LIMIT 1), 'whatsapp', '919000000003', 'Neha Patel', 
   '🔥 Diwali Special! Get 40% off on all AI/ML courses. Limited time offer - enroll now! [Link]', 
   'sent', '2024-10-20 09:05:00', NULL, NULL, NULL, NULL, NULL),
  -- New Year Learning Resolution recipients
  ((SELECT id FROM mh_campaigns WHERE name='New Year Learning Resolution' LIMIT 1), 
   (SELECT id FROM contacts WHERE email='vikram@example.com' LIMIT 1), 'email', 'vikram@example.com', 'Vikram Joshi', 
   'Start 2025 with new skills! 🚀 Our comprehensive Full Stack Development course is now open for enrollment. Early bird discount available.', 
   'delivered', '2024-12-28 10:02:00', '2024-12-28 10:03:00', '2024-12-28 14:30:00', '2024-12-28 15:45:00', NULL, NULL),
  ((SELECT id FROM mh_campaigns WHERE name='New Year Learning Resolution' LIMIT 1), 
   (SELECT id FROM contacts WHERE email='pooja@example.com' LIMIT 1), 'email', 'pooja@example.com', 'Pooja Mehta', 
   'Start 2025 with new skills! 🚀 Our comprehensive Full Stack Development course is now open for enrollment. Early bird discount available.', 
   'failed', '2024-12-28 10:02:00', NULL, NULL, NULL, NULL, 'bounced'),
  -- Corporate Training B2B Outreach recipients
  ((SELECT id FROM mh_campaigns WHERE name='Corporate Training B2B Outreach' LIMIT 1), 
   (SELECT id FROM contacts WHERE email='amit@example.com' LIMIT 1), 'linkedin', 'amit-kumar-linkedin', 'Amit Kumar', 
   '🏢 Upskill your team with our corporate training programs. AI/ML, Data Science, Cloud Computing. Custom solutions available.', 
   'replied', '2024-11-05 09:35:00', '2024-11-05 09:36:00', '2024-11-05 10:15:00', '2024-11-05 11:30:00', '2024-11-05 14:20:00', NULL)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Assets (20 records) ----------
INSERT INTO mh_assets (organization_id, name, type, file_path, file_size, mime_type, metadata, tags) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'AI Course Banner', 'image', '/assets/ai-course-banner.jpg', 245760, 'image/jpeg', '{"width":1920,"height":600,"alt":"AI Course Promotion Banner"}', '{"campaign": "ai", "banner"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Data Science Infographic', 'image', '/assets/data-science-infographic.png', 384512, 'image/png', '{"width":1080,"height":1080,"alt":"Data Science Career Path"}', '{"infographic": "data_science"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Course Promo Video', 'video', '/assets/course-promo.mp4', 15728640, 'video/mp4', '{"duration":180,"resolution":"1080p"}', '{"video": "promo"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Brochure PDF', 'document', '/assets/course-brochure.pdf', 524288, 'application/pdf', '{"pages":12,"title":"Complete Course Catalog"}', '{"document": "brochure"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Podcast Episode', 'audio', '/assets/tech-podcast-ep1.mp3', 8388608, 'audio/mpeg', '{"duration":2400,"episode":1}', '{"audio": "podcast"}'),
  ((SELECT id FROM organizations LIMIT 1), 'WhatsApp Template', 'template', '/templates/whatsapp-promo.json', 4096, 'application/json', '{"variables":3,"language":"en"}', '{"template": "whatsapp"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Email Template', 'template', '/templates/email-newsletter.html', 8192, 'text/html', '{"sections":5,"responsive":true}', '{"template": "email"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Instructor Photo', 'image', '/assets/instructor-photo.jpg', 147456, 'image/jpeg', '{"width":400,"height":400,"alt":"Lead Instructor"}', '{"image": "instructor"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Student Testimonial', 'video', '/assets/student-testimonial.mp4', 5242880, 'video/mp4', '{"duration":90,"student":"alumni"}', '{"video": "testimonial"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Syllabus PDF', 'document', '/assets/syllabus-ai.pdf', 262144, 'application/pdf', '{"pages":8,"course":"AI/ML"}', '{"document": "syllabus"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Logo Transparent', 'image', '/assets/logo-transparent.png', 73728, 'image/png', '{"width":500,"height":500,"bg":"transparent"}', '{"brand": "logo"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Social Media Post', 'image', '/assets/social-post.jpg', 196608, 'image/jpeg', '{"platform":"instagram","size":"1080x1080"}', '{"social": "instagram"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Course Certificate Sample', 'document', '/assets/certificate-sample.pdf', 393216, 'application/pdf', '{"template":"certificate"}', '{"document": "certificate"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Workshop Recording', 'video', '/assets/workshop-recording.mp4', 31457280, 'video/mp4', '{"duration":7200,"date":"2024-10-15"}', '{"video": "workshop"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Email Signature', 'image', '/assets/email-signature.png', 24576, 'image/png', '{"width":600,"height":100}', '{"brand": "signature"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Case Study PDF', 'document', '/assets/case-study.pdf', 524288, 'application/pdf', '{"pages":15,"company":"techcorp"}', '{"document": "case_study"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Team Photo', 'image', '/assets/team-photo.jpg', 327680, 'image/jpeg', '{"width":1920,"height":1080,"people":8}', '{"team": "photo"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Podcast Cover Art', 'image', '/assets/podcast-cover.jpg', 163840, 'image/jpeg', '{"width":1400,"height":1400,"episode":1}', '{"audio": "cover"}'),
  ((SELECT id FROM organizations LIMIT 1), 'FAQ Document', 'document', '/assets/faq.pdf', 131072, 'application/pdf', '{"pages":5,"category":"general"}', '{"document": "faq"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Banner Vertical', 'image', '/assets/banner-vertical.jpg', 212992, 'image/jpeg', '{"width":1080,"height":1920,"orientation":"portrait"}', '{"campaign": "banner"}')
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Templates (18 records) ----------
INSERT INTO mh_templates (organization_id, name, category, channel, content, preview_data, usage_count, is_public) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Course Launch WhatsApp', 'campaign', 'whatsapp', 
   '{"subject":"","body":"🚀 New Course Launch! {{course_name}} is now live. 🎯 {{course_benefits}} Enroll now: {{enroll_link}} Offer valid till: {{expiry_date}}","variables":["course_name","course_benefits","enroll_link","expiry_date"]}', 
   '{"preview":"🚀 New Course Launch! AI/ML is now live. 🎯 Hands-on projects, industry mentorship. Enroll now: electrobtech.com/ai Offer valid till: Dec 31"}', 45, true),
  ((SELECT id FROM organizations LIMIT 1), 'Webinar Invitation Email', 'webinar', 'email', 
   '{"subject":"Join Our Free Webinar: {{webinar_topic}}","body":"You are invited to our upcoming webinar on {{webinar_topic}}. 📅 Date: {{date}} ⏰ Time: {{time}} 🎓 What you will learn: {{learning_points}} Register here: {{registration_link}}","variables":["webinar_topic","date","time","learning_points","registration_link"]}', 
   '{"preview":"Subject: Join Our Free Webinar: Data Science Careers"}', 32, true),
  ((SELECT id FROM organizations LIMIT 1), 'Discount Offer SMS', 'promotion', 'sms', 
   '{"subject":"","body":"{{discount}}% OFF on {{course_name}}! Limited time. Use code: {{promo_code}}. Call {{phone}} to enroll.","variables":["discount","course_name","promo_code","phone"]}', 
   '{"preview":"40% OFF on AI Course! Limited time. Use code: DIWALI40. Call 9876543210 to enroll."}', 28, true),
  ((SELECT id FROM organizations LIMIT 1), 'Instagram Carousel', 'social', 'instagram', 
   '{"subject":"","body":"Slide 1: {{hook}} Slide 2: {{problem}} Slide 3: {{solution}} Slide 4: {{cta}} Hashtags: {{hashtags}}","variables":["hook","problem","solution","cta","hashtags"]}', 
   '{"preview":"Career in AI? 🤖 Problem: Don\'t know where to start Solution: Our structured AI course CTA: Link in bio"}', 15, false),
  ((SELECT id FROM organizations LIMIT 1), 'Corporate Training Proposal', 'b2b', 'email', 
   '{"subject":"Corporate Training Proposal for {{company_name}}","body":"Dear {{contact_name}}, Based on our discussion, here is our customized training proposal for {{company_name}}. 📋 Program: {{program_name}} 👥 Team Size: {{team_size}} 💰 Investment: {{investment}} Please find the detailed proposal attached.","variables":["company_name","contact_name","program_name","team_size","investment"]}', 
   '{"preview":"Subject: Corporate Training Proposal for TechCorp"}', 8, false),
  ((SELECT id FROM organizations LIMIT 1), 'Course Completion Email', 'engagement', 'email', 
   '{"subject":"Congratulations on Completing {{course_name}}!","body":"Dear {{student_name}}, 🎉 Congratulations on successfully completing {{course_name}}! Your certificate is attached. 📜 Continue your learning journey with {{next_course} - {{discount}}% off for alumni.","variables":["student_name","course_name","next_course","discount"]}', 
   '{"preview":"Subject: Congratulations on Completing AI/ML!"}', 67, true),
  ((SELECT id FROM organizations LIMIT 1), 'Abandoned Cart Reminder', 'recovery', 'email', 
   '{"subject":"Complete Your Enrollment - {{course_name}}","body":"Hi {{name}}, You started enrolling in {{course_name}} but didn\'t complete it. 🎓 {{benefit}} Complete your enrollment now: {{link}} Questions? Call us at {{phone}}","variables":["name","course_name","benefit","link","phone"]}', 
   '{"preview":"Subject: Complete Your Enrollment - Full Stack Development"}', 23, true),
  ((SELECT id FROM organizations LIMIT 1), 'LinkedIn Post Template', 'social', 'linkedin', 
   '{"subject":"","body":"{{hook}} {{key_points}} {{cta}} {{hashtags}}","variables":["hook","key_points","cta","hashtags"]}', 
   '{"preview":"5 Skills for 2025: AI, Cloud, Cybersecurity, Data Science, DevOps. Which one are you learning? #tech #careers"}', 19, false),
  ((SELECT id FROM organizations LIMIT 1), 'Free Trial Invitation', 'acquisition', 'whatsapp', 
   '{"subject":"","body":"Try {{course_name}} for FREE! 🆓 {{trial_duration}} days trial access. No credit card required. Start learning: {{trial_link}}","variables":["course_name","trial_duration","trial_link"]}', 
   '{"preview":"Try Data Science for FREE! 🆓 7 days trial access. No credit card required."}', 41, true),
  ((SELECT id FROM organizations LIMIT 1), 'Seasonal Greeting', 'engagement', 'email', 
   '{"subject":"{{greeting}} from Electrobtech Innovations!","body":"Dear {{name}}, {{seasonal_message}} 🎁 Special offer: {{offer}} Valid till: {{validity}} Wishing you {{wishes}}","variables":["name","seasonal_message","offer","validity","wishes"]}', 
   '{"preview":"Subject: Diwali Greetings from Electrobtech Innovations!"}', 12, false),
  ((SELECT id FROM organizations LIMIT 1), 'Live Class Reminder', 'engagement', 'whatsapp', 
   '{"subject":"","body":"🔔 Reminder: Live class for {{course_name}} ⏰ Time: {{time}} 📅 Date: {{date}} 🎯 Topic: {{topic}} Join link: {{class_link}}","variables":["course_name","time","date","topic","class_link"]}', 
   '{"preview":"🔔 Reminder: Live class for AI/ML ⏰ Time: 7:00 PM"}', 89, true),
  ((SELECT id FROM organizations LIMIT 1), 'Feedback Request', 'engagement', 'email', 
   '{"subject":"How was your experience with {{course_name}}?","body":"Hi {{name}}, You recently completed {{course_name}}. We would love to hear your feedback! ⭐ Rate your experience: {{survey_link}} Your feedback helps us improve.","variables":["name","course_name","survey_link"]}', 
   '{"preview":"Subject: How was your experience with Data Science?"}', 54, true),
  ((SELECT id FROM organizations LIMIT 1), 'Job Alert Email', 'placement', 'email', 
   '{"subject":"New Job Opening: {{job_role}} at {{company}}","body":"Hi {{name}}, We found a job opening matching your profile! 💼 Role: {{job_role}} Company: {{company}} 📍 Location: {{location}} Apply here: {{apply_link}} Good luck!","variables":["name","job_role","company","location","apply_link"]}', 
   '{"preview":"Subject: New Job Opening: Data Scientist at TechCorp"}', 37, true),
  ((SELECT id FROM organizations LIMIT 1), 'Referral Program Invite', 'growth', 'email', 
   '{"subject":"Refer a Friend, Earn {{reward}}!","body":"Hi {{name}}, Refer your friends to {{course_name}} and earn {{reward}} for each successful enrollment! 🎁 Your referral link: {{referral_link}} Share and earn!","variables":["name","course_name","reward","referral_link"]}', 
   '{"preview":"Subject: Refer a Friend, Earn ₹2000!"}', 18, false),
  ((SELECT id FROM organizations LIMIT 1), 'Birthday Greeting', 'engagement', 'whatsapp', 
   '{"subject":"","body":"🎂 Happy Birthday {{name}}! On your special day, we wish you success in all your learning endeavors. 🎁 Birthday gift: {{gift_offer}} Enjoy your day!","variables":["name","gift_offer"]}', 
   '{"preview":"🎂 Happy Birthday Rohan! Special 25% off on all courses as our birthday gift!"}', 9, false),
  ((SELECT id FROM organizations LIMIT 1), 'Batch Start Notification', 'engagement', 'email', 
   '{"subject":"New Batch Starting: {{course_name}}","body":"Dear {{name}}, A new batch of {{course_name}} is starting on {{start_date}}! 📅 Schedule: {{schedule}} 🎯 Early bird: {{discount}}% off Enroll now: {{enroll_link}}","variables":["name","course_name","start_date","schedule","discount","enroll_link"]}', 
   '{"preview":"Subject: New Batch Starting: Machine Learning"}', 63, true),
  ((SELECT id FROM organizations LIMIT 1), 'Certificate Issue Notification', 'certification', 'email', 
   '{"subject":"Your Certificate is Ready!","body":"Congratulations {{name}}! 🎉 Your certificate for {{course_name}} is ready. 📜 Download here: {{certificate_link}} Add it to your LinkedIn profile!","variables":["name","course_name","certificate_link"]}', 
   '{"preview":"Subject: Your Certificate is Ready!"}', 71, true)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Content Studio (16 records) ----------
INSERT INTO mh_content_studio (organization_id, name, type, channel, content, status, scheduled_at, tags, performance) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'AI Course Promotion Post', 'post', 'instagram', 
   '{"caption":"Master AI in 2025! 🤖 Our comprehensive AI/ML course covers neural networks, deep learning, and real-world projects. Link in bio! #AI #MachineLearning #TechEducation","media":["ai-course-promo.jpg"],"hashtags":["AI","MachineLearning","TechEducation"]}', 
   'published', '2024-11-01 10:00:00', '{"campaign": "ai", "education"}', '{"likes":245,"comments":32,"shares":18,"impressions":4500}'),
  ((SELECT id FROM organizations LIMIT 1), 'Data Science Career Guide', 'post', 'linkedin', 
   '{"caption":"Thinking about a career in Data Science? 📊 Here\'s your complete roadmap: 1. Learn Python 2. Master Statistics 3. Study ML Algorithms 4. Build Projects 5. Get Certified Our Data Science course covers it all! Link in comments.","media":["data-science-roadmap.png"],"hashtags":["DataScience","CareerAdvice"]}', 
   'published', '2024-11-05 14:00:00', '{"career": "data_science"}', '{"likes":189,"comments":45,"shares":28,"impressions":3200}'),
  ((SELECT id FROM organizations LIMIT 1), 'Black Friday Campaign Email', 'campaign', 'email', 
   '{"subject":"🛒 Black Friday: Buy 2 Get 1 FREE!","body":"Our biggest sale of the year is here! Buy any 2 courses and get the 3rd absolutely FREE. AI, Data Science, Full Stack - all included. Offer valid till Nov 30. Shop now!","cta":"Shop Now","priority":"high"}', 
   'published', '2024-11-25 08:00:00', '{"campaign": "black_friday", "sale"}', '{"opens":1250,"clicks":178,"conversions":45,"unsubscribes":12}'),
  ((SELECT id FROM organizations LIMIT 1), 'Student Success Story', 'post', 'instagram', 
   '{"caption":"From student to Data Scientist at Google! 🎉 Our alumni Ananya shares her journey: \"Electrobtech\'s practical approach made all the difference. The projects were real-world challenges that prepared me for interviews.\" Start your journey today! Link in bio.","media":["student-success-video.mp4"],"hashtags":["SuccessStory","DataScience"]}', 
   'published', '2024-11-10 16:00:00', '{"testimonial": "student"}', '{"likes":387,"comments":56,"shares":42,"impressions":6800}'),
  ((SELECT id FROM organizations LIMIT 1), 'Corporate Training Brochure', 'template', 'email', 
   '{"subject":"Corporate Training Solutions 2025","body":"Transform your workforce with our customized corporate training programs. AI/ML, Cloud, DevOps, and more. Flexible schedules, on-site or online. Request a quote today!","cta":"Request Quote","type":"b2b"}', 
   'approved', '2024-12-01 09:00:00', '{"corporate": "training"}', '{}'),
  ((SELECT id FROM organizations LIMIT 1), 'React Workshop Announcement', 'post', 'whatsapp', 
   '{"body":"📱 React Native Workshop - Learn to build mobile apps in 4 weeks! 🔹 Week 1: React Basics 🔹 Week 2: Navigation 🔹 Week 3: APIs 🔹 Week 4: Deployment Starting Nov 18th. Limited seats. Reply WORKSHOP to register!","type":"announcement"}', 
   'published', '2024-11-12 11:00:00', '{"workshop": "react"}', '{"sent":850,"delivered":790,"read":420,"replied":78}'),
  ((SELECT id FROM organizations LIMIT 1), 'Year-End Learning Push', 'campaign', 'email', 
   '{"subject":"🚀 Finish 2024 Strong - Start 2025 Skilled!","body":"Don\'t wait till January! Start learning now and get ahead. Special year-end offer: 30% off on all courses. Use code: NEWYEAR30 Invest in yourself today!","cta":"Enroll Now","urgency":"high"}', 
   'draft', '2024-12-20 10:00:00', '{"campaign": "year_end"}', '{}'),
  ((SELECT id FROM organizations LIMIT 1), 'Industry Trends Article', 'post', 'linkedin', 
   '{"caption":"5 Tech Trends That Will Define 2025: 1. AI Automation 2. Edge Computing 3. Quantum Computing 4. Sustainable Tech 5. Extended Reality Stay ahead with our cutting-edge courses. Which trend interests you most?","media":["tech-trends-2025.jpg"],"hashtags":["TechTrends","FutureTech"]}', 
   'review', '2024-11-15 09:00:00', '{"content": "trends"}', '{}'),
  ((SELECT id FROM organizations LIMIT 1), 'Women in Tech Campaign', 'campaign', 'instagram', 
   '{"caption":"💪 Women in Tech Scholarship Program! We believe in diversity in tech. 50% scholarship for female candidates in all our courses. DM us WOMENINTECH to apply! Share this with someone who needs it.","media":["women-in-tech.jpg"],"hashtags":["WomenInTech","Scholarship"]}', 
   'published', '2024-11-08 12:00:00', '{"campaign": "women_tech"}', '{"likes":512,"comments":89,"shares":67,"impressions":8900}'),
  ((SELECT id FROM organizations LIMIT 1), 'Free Webinar Promo', 'post', 'facebook', 
   '{"caption":"🎓 FREE WEBINAR: AI Career Paths in 2025 Join our industry experts as they discuss: - AI job market trends - Required skills - Salary expectations - Growth opportunities Saturday, Nov 16th at 3 PM. Register link in comments!","media":["webinar-promo.jpg"],"hashtags":["Webinar","AI","FreeEvent"]}', 
   'published', '2024-11-13 14:30:00', '{"event": "webinar"}', '{"likes":328,"comments":67,"shares":34,"reactions":156}'),
  ((SELECT id FROM organizations LIMIT 1), 'Cybersecurity Awareness Post', 'post', 'linkedin', 
   '{"caption":"🔒 Cybersecurity is everyone\'s responsibility. Our new Cybersecurity Basics course teaches: - Network security fundamentals - Ethical hacking basics - Data protection best practices - Threat detection 6-week program starting Dec 1st. Link in bio!","media":["cybersecurity-promo.jpg"],"hashtags":["Cybersecurity","InfoSec"]}', 
   'draft', '2024-11-25 10:00:00', '{"course": "cybersecurity"}', '{}'),
  ((SELECT id FROM organizations LIMIT 1), 'New Year Resolution Campaign', 'campaign', 'whatsapp', 
   '{"body":"🎯 New Year, New Skills! Make 2025 your year of growth. Our top courses for 2025: 🚀 AI/ML 📊 Data Science 💻 Full Stack ☁️ Cloud Computing Early bird: 25% off till Jan 15th. Reply SKILL to get course details!","type":"motivation"}', 
   'scheduled', '2025-01-01 09:00:00', '{"campaign": "new_year"}', '{}'),
  ((SELECT id FROM organizations LIMIT 1), 'Instructor Introduction', 'post', 'instagram', 
   '{"caption":"Meet our Lead Instructor, Dr. Rajesh Kumar! 🎓 PhD in AI from IIT 15+ years industry experience Trained 10,000+ students \"My goal is to make AI accessible to everyone.\" Learn from the best! Link in bio.","media":["instructor-video.mp4"],"hashtags":["Instructor","AI","Learning"]}', 
   'published', '2024-11-06 16:00:00', '{"team": "instructor"}', '{"likes":298,"comments":41,"shares":23,"impressions":5600}'),
  ((SELECT id FROM organizations LIMIT 1), 'Placement Statistics Infographic', 'post', 'linkedin', 
   '{"caption":"Our 2024 Placement Results 📊 95% Placement Rate 450+ Students Placed Average Package: ₹8.5 LPA Top Companies: Google, Microsoft, Amazon, Flipkart Our students are shaping the future of tech! Join them. Link in bio.","media":["placement-stats.jpg"],"hashtags":["Placements","Careers"]}', 
   'published', '2024-11-20 11:00:00', '{"achievement": "placements"}', '{"likes":445,"comments":78,"shares":56,"impressions":7800}'),
  ((SELECT id FROM organizations LIMIT 1), 'Holiday Offer Email', 'campaign', 'email', 
   '{"subject":"🎄 Holiday Special - Gift of Learning!","body":"Give the gift of knowledge this holiday season! Gift our courses to your loved ones. 🎁 Instant digital delivery 📜 Beautiful certificate 💡 Lifetime access Holiday special: 35% off on all gift purchases!","cta":"Gift Now","emotion":"festive"}', 
   'draft', '2024-12-15 10:00:00', '{"campaign": "holiday"}', '{}'),
  ((SELECT id FROM organizations LIMIT 1), 'Tech Tip Tuesday', 'post', 'twitter', 
   '{"caption":"#TechTipTuesday: Always test your code before deployment! 🧪 Simple rule that saves hours of debugging. Pro tip: Use automated testing frameworks. What\'s your testing workflow?","media":[],"hashtags":["TechTip","Coding","BestPractices"]}', 
   'published', '2024-11-19 09:00:00', '{"content": "tips"}', '{"likes":156,"retweets":34,"replies":28,"impressions":4200}')
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub SEO Keywords (20 records) ----------
INSERT INTO mh_seo_keywords (organization_id, keyword, search_volume, difficulty, current_rank, target_rank, url, competition, cpc, trend_data) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'AI course online', 14400, 68, 12, 5, 'electrobtech.com/ai-course', 0.72, 2.50, '{"2024-06":12000,"2024-07":13200,"2024-08":13800,"2024-09":14400}'),
  ((SELECT id FROM organizations LIMIT 1), 'data science certification', 22100, 74, 18, 8, 'electrobtech.com/data-science', 0.78, 3.20, '{"2024-06":19500,"2024-07":20500,"2024-08":21200,"2024-09":22100}'),
  ((SELECT id FROM organizations LIMIT 1), 'machine learning training', 18100, 65, 15, 6, 'electrobtech.com/machine-learning', 0.68, 2.80, '{"2024-06":16000,"2024-07":16800,"2024-08":17500,"2024-09":18100}'),
  ((SELECT id FROM organizations LIMIT 1), 'full stack development course', 24400, 72, 22, 10, 'electrobtech.com/full-stack', 0.75, 2.95, '{"2024-06":22000,"2024-07":22800,"2024-08":23600,"2024-09":24400}'),
  ((SELECT id FROM organizations LIMIT 1), 'embedded systems course', 8900, 58, 8, 3, 'electrobtech.com/embedded-systems', 0.62, 2.10, '{"2024-06":7800,"2024-07":8200,"2024-08":8600,"2024-09":8900}'),
  ((SELECT id FROM organizations LIMIT 1), 'python programming online', 40500, 55, 25, 12, 'electrobtech.com/python', 0.58, 1.80, '{"2024-06":38000,"2024-07":39000,"2024-08":39800,"2024-09":40500}'),
  ((SELECT id FROM organizations LIMIT 1), 'react native tutorial', 32200, 62, 20, 8, 'electrobtech.com/react-native', 0.65, 2.40, '{"2024-06":29000,"2024-07":30000,"2024-08":31200,"2024-09":32200}'),
  ((SELECT id FROM organizations LIMIT 1), 'cloud computing certification', 28600, 70, 28, 15, 'electrobtech.com/cloud-computing', 0.74, 3.00, '{"2024-06":26000,"2024-07":27000,"2024-08":27800,"2024-09":28600}'),
  ((SELECT id FROM organizations LIMIT 1), 'data science course fees', 12100, 45, 5, 2, 'electrobtech.com/data-science-fees', 0.48, 1.50, '{"2024-06":10500,"2024-07":11000,"2024-08":11500,"2024-09":12100}'),
  ((SELECT id FROM organizations LIMIT 1), 'best AI training institute', 9600, 82, 3, 1, 'electrobtech.com/about', 0.85, 4.20, '{"2024-06":8200,"2024-07":8700,"2024-08":9200,"2024-09":9600}'),
  ((SELECT id FROM organizations LIMIT 1), 'machine learning projects', 18900, 60, 16, 7, 'electrobtech.com/ml-projects', 0.63, 2.65, '{"2024-06":16500,"2024-07":17500,"2024-08":18200,"2024-09":18900}'),
  ((SELECT id FROM organizations LIMIT 1), 'web development bootcamp', 15600, 68, 14, 6, 'electrobtech.com/web-dev-bootcamp', 0.72, 2.75, '{"2024-06":13500,"2024-07":14200,"2024-08":14900,"2024-09":15600}'),
  ((SELECT id FROM organizations LIMIT 1), 'data analyst course', 26800, 58, 19, 9, 'electrobtech.com/data-analyst', 0.61, 2.35, '{"2024-06":24000,"2024-07":25000,"2024-08":25800,"2024-09":26800}'),
  ((SELECT id FROM organizations LIMIT 1), 'cybersecurity training', 14200, 65, 11, 5, 'electrobtech.com/cybersecurity', 0.68, 2.55, '{"2024-06":12500,"2024-07":13200,"2024-08":13700,"2024-09":14200}'),
  ((SELECT id FROM organizations LIMIT 1), 'iot certification course', 7800, 52, 7, 3, 'electrobtech.com/iot', 0.55, 1.95, '{"2024-06":6800,"2024-07":7200,"2024-08":7500,"2024-09":7800}'),
  ((SELECT id FROM organizations LIMIT 1), 'devops training online', 19500, 62, 17, 8, 'electrobtech.com/devops', 0.65, 2.70, '{"2024-06":17000,"2024-07":18000,"2024-08":18800,"2024-09":19500}'),
  ((SELECT id FROM organizations LIMIT 1), 'artificial intelligence certification', 33500, 75, 24, 12, 'electrobtech.com/ai-certification', 0.78, 3.40, '{"2024-06":30000,"2024-07":31500,"2024-08":32500,"2024-09":33500}'),
  ((SELECT id FROM organizations LIMIT 1), 'blockchain development course', 11200, 70, 9, 4, 'electrobtech.com/blockchain', 0.73, 3.10, '{"2024-06":9500,"2024-07":10200,"2024-08":10700,"2024-09":11200}'),
  ((SELECT id FROM organizations LIMIT 1), 'digital marketing course', 28900, 58, 21, 10, 'electrobtech.com/digital-marketing', 0.62, 2.25, '{"2024-06":26000,"2024-07":27000,"2024-08":28000,"2024-09":28900}'),
  ((SELECT id FROM organizations LIMIT 1), 'ethical hacking certification', 13400, 68, 13, 6, 'electrobtech.com/ethical-hacking', 0.72, 2.90, '{"2024-06":11500,"2024-07":12200,"2024-08":12800,"2024-09":13400}')
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Settings (15 records) ----------
INSERT INTO mh_settings (organization_id, category, key, value, description, is_public) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'general', 'workspace_name', '"Electrobtech Innovations"', 'Organization workspace name', true),
  ((SELECT id FROM organizations LIMIT 1), 'general', 'timezone', '"Asia/Kolkata"', 'Default timezone for organization', true),
  ((SELECT id FROM organizations LIMIT 1), 'general', 'language', '"English"', 'Default language', true),
  ((SELECT id FROM organizations LIMIT 1), 'general', 'currency', '"INR"', 'Default currency', true),
  ((SELECT id FROM organizations LIMIT 1), 'sandbox', 'enabled', 'true', 'Sandbox mode for campaign delivery simulation', false),
  ((SELECT id FROM organizations LIMIT 1), 'sandbox', 'simulation_batch_size', '100', 'Number of messages per batch in simulation', false),
  ((SELECT id FROM organizations LIMIT 1), 'sandbox', 'simulation_delay_ms', '1000', 'Delay between batches in milliseconds', false),
  ((SELECT id FROM organizations LIMIT 1), 'notifications', 'campaign_alerts', 'true', 'Enable campaign performance alerts', true),
  ((SELECT id FROM organizations LIMIT 1), 'notifications', 'lead_notifications', 'true', 'Enable new lead notifications', true),
  ((SELECT id FROM organizations LIMIT 1), 'notifications', 'weekly_report', 'true', 'Enable weekly summary reports', true),
  ((SELECT id FROM organizations LIMIT 1), 'notifications', 'ai_insights', 'true', 'Enable AI-driven recommendations', true),
  ((SELECT id FROM organizations LIMIT 1), 'analytics', 'retention_days', '90', 'Days to retain analytics data', false),
  ((SELECT id FROM organizations LIMIT 1), 'analytics', 'real_time_updates', 'true', 'Enable real-time analytics updates', false),
  ((SELECT id FROM organizations LIMIT 1), 'files', 'max_file_size', '50MB', 'Maximum file upload size', false),
  ('11111111-1111-1111-1111-1111-111111111111', 'files', 'allowed_types', '["jpg","jpeg","png","gif","webp","svg","pdf","doc","docx","mp4","mov","avi","mp3","wav"]', 'Allowed file types for upload', false)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Integrations (12 records) ----------
INSERT INTO mh_integrations (organization_id, provider, service_type, credentials, configuration, status, last_sync) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Facebook Ads', 'social', '{"access_token":"mock_token_12345","account_id":"act_123456"}', '{"pixel_id":"pixel_123","conversion_events":["lead","purchase"]}', 'active', '2024-11-01 10:00:00'),
  ((SELECT id FROM organizations LIMIT 1), 'Google Ads', 'analytics', '{"api_key":"mock_google_key","customer_id":"123-456-7890"}', '{"conversion_tracking":true,"remarketing_tags":true}', 'active', '2024-11-01 09:30:00'),
  ((SELECT id FROM organizations LIMIT 1), 'WhatsApp Business', 'social', '{"phone_number_id":"9876543210","api_key":"mock_whatsapp_key"}', '{"message_templates":5,"webhook_url":"https://electrobtech.com/webhook"}', 'active', '2024-11-01 11:00:00'),
  ((SELECT id FROM organizations LIMIT 1), 'Email (SMTP)', 'email', '{"host":"smtp.electrobtech.com","port":587,"username":"notifications@electrobtech.com"}', '{"from_name":"Electrobtech Innovations","bounce_handling":true}', 'active', '2024-11-01 08:00:00'),
  ((SELECT id FROM organizations LIMIT 1), 'LinkedIn Ads', 'social', '{"access_token":"mock_linkedin_token","account_id":"789"}', '{"company_page":"electrobtech-innovations","lead_forms":true}', 'inactive', NULL),
  ((SELECT id FROM organizations LIMIT 1), 'Google Analytics', 'analytics', '{"tracking_id":"UA-123456789-1","api_key":"mock_ga_key"}', '{"custom_dimensions":5,"goals":3}', 'active', '2024-11-01 10:30:00'),
  ((SELECT id FROM organizations LIMIT 1), 'Zapier', 'crm', '{"api_key":"mock_zapier_key"}', '{"automations":12,"triggers":["new_lead","campaign_complete"]}', 'active', '2024-11-01 09:00:00'),
  ((SELECT id FROM organizations LIMIT 1), 'Shopify', 'ecommerce', '{"api_key":"mock_shopify_key","password":"mock_password","store_url":"electrobtech.myshopify.com"}', '{"sync_products":true,"sync_orders":true}', 'inactive', NULL),
  ((SELECT id FROM organizations LIMIT 1), 'Stripe', 'ecommerce', '{"secret_key":"sk_mock_secret_key","publishable_key":"pk_mock_publishable"}', '{"webhook_endpoint":"https://electrobtech.com/stripe-webhook"}', 'active', '2024-11-01 08:30:00'),
  ((SELECT id FROM organizations LIMIT 1), 'Instagram Business', 'social', '{"access_token":"mock_instagram_token","business_account":"ig_123456"}', '{"story_insights":true,"comment_monitoring":true}', 'active', '2024-11-01 11:30:00'),
  ((SELECT id FROM organizations LIMIT 1), 'Twitter/X', 'social', '{"api_key":"mock_twitter_key","api_secret":"mock_twitter_secret","access_token":"mock_access_token"}', '{"tweet_scheduling":true,"mention_tracking":true}', 'inactive', NULL),
  ((SELECT id FROM organizations LIMIT 1), 'YouTube', 'social', '{"api_key":"mock_youtube_key","channel_id":"UC1234567890"}', '{"video_analytics":true,"comment_management":true}', 'error', '2024-10-28 15:00:00')
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Calendar Events (15 records) ----------
INSERT INTO mh_calendar_events (organization_id, title, description, event_type, start_date, end_date, all_day, assignees, status, metadata) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Diwali Campaign Launch', 'Launch Diwali Flash Sale campaign across all channels', 'campaign', '2024-10-20 09:00:00', '2024-10-25 23:59:00', false, ARRAY[(SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)], 'completed', '{"priority":"high","channels":["whatsapp","email","instagram"]}'),
  ((SELECT id FROM organizations LIMIT 1), 'New Year Campaign Planning', 'Plan and schedule New Year learning resolution campaign', 'campaign', '2024-12-20 10:00:00', '2024-12-20 18:00:00', false, ARRAY[(SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)], 'scheduled', '{"priority":"high","budget":25000}'),
  ((SELECT id FROM organizations LIMIT 1), 'Data Science Webinar', 'Free webinar on Data Science career paths', 'content', '2024-11-16 15:00:00', '2024-11-16 17:00:00', false, ARRAY[(SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)], 'in_progress', '{"platform":"zoom","expected_attendees":200}'),
  ((SELECT id FROM organizations LIMIT 1), 'Black Friday Sale Preparation', 'Prepare Black Friday campaign assets and messaging', 'deadline', '2024-11-20 17:00:00', NULL, false, ARRAY[(SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)], 'completed', '{"assets":["banners","emails","social_posts"]}'),
  ((SELECT id FROM organizations LIMIT 1), 'React Native Workshop', '4-week React Native intensive workshop', 'launch', '2024-11-18 10:00:00', '2024-12-15 18:00:00', false, ARRAY[(SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)], 'in_progress', '{"batch_size":30,"schedule":"weekend"}'),
  ((SELECT id FROM organizations LIMIT 1), 'Corporate Training Follow-up', 'Follow up with corporate training leads', 'meeting', '2024-11-12 14:00:00', '2024-11-12 15:30:00', false, ARRAY[(SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)], 'completed', '{"leads_count":15}'),
  ((SELECT id FROM organizations LIMIT 1), 'Content Creation Sprint', 'Create content for Q1 2025 campaigns', 'content', '2024-12-02 09:00:00', '2024-12-06 18:00:00', false, ARRAY[(SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)], 'scheduled', '{"content_types":["blog","social","email"]}'),
  ((SELECT id FROM organizations LIMIT 1), 'SEO Strategy Review', 'Review and update SEO strategy for 2025', 'meeting', '2024-11-25 11:00:00', '2024-11-25 13:00:00', false, ARRAY[(SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1), (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)], 'scheduled', '{"focus_keywords":15}'),
  ((SELECT id FROM organizations LIMIT 1), 'Influencer Collaboration', 'Plan influencer collaboration for course promotion', 'campaign', '2024-12-10 10:00:00', '2024-12-20 18:00:00', false, ARRAY[(SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)], 'scheduled', '{"influencers":5,"budget":15000}'),
  ((SELECT id FROM organizations LIMIT 1), 'Monthly Analytics Review', 'Review monthly marketing analytics and performance', 'meeting', '2024-11-30 16:00:00', '2024-11-30 17:30:00', false, ARRAY[(SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1), (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)], 'scheduled', '{"metrics":["roi","conversion","engagement"]}'),
  ((SELECT id FROM organizations LIMIT 1), 'Women in Tech Campaign', 'Launch women in tech scholarship campaign', 'campaign', '2024-11-15 09:00:00', '2024-12-15 23:59:00', false, ARRAY[(SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)], 'in_progress', '{"scholarship_slots":50,"channels":["instagram","linkedin","email"]}'),
  ((SELECT id FROM organizations LIMIT 1), 'Email List Cleanup', 'Clean and segment email marketing lists', 'deadline', '2024-11-08 18:00:00', NULL, false, ARRAY[(SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1)], 'completed', '{"subscribers_before":15000,"subscribers_after":14200}'),
  ((SELECT id FROM organizations LIMIT 1), 'Video Content Production', 'Produce course promotional videos', 'content', '2024-11-05 09:00:00', '2024-11-22 18:00:00', false, ARRAY[(SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)], 'completed', '{"videos_produced":8,"total_duration":45}'),
  ((SELECT id FROM organizations LIMIT 1), 'Partnership Outreach', 'Reach out to potential training partners', 'meeting', '2024-12-05 14:00:00', '2024-12-05 16:00:00', false, ARRAY[(SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1)], 'scheduled', '{"target_partners":10}'),
  ((SELECT id FROM organizations LIMIT 1), 'Q4 Performance Review', 'Review Q4 marketing performance and plan Q1', 'meeting', '2025-01-02 10:00:00', '2025-01-02 17:00:00', false, ARRAY[(SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1), (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1)], 'scheduled', '{"review_period":"Q4_2024"}')
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Knowledge Articles (15 records) ----------
INSERT INTO mh_knowledge_articles (organization_id, title, content, category, tags, author_id, status, view_count, helpful_count) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Getting Started with Marketing Hub', 'The Marketing Hub is your central command for all marketing activities. This guide covers the basics of campaigns, audiences, and analytics. Learn how to create your first campaign, segment your audience, and track performance metrics effectively.', 'Onboarding', '{"getting-started","basics","tutorial"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1), 'published', 245, 18),
  ((SELECT id FROM organizations LIMIT 1), 'Campaign Best Practices', 'Learn the proven strategies for successful marketing campaigns. This guide covers audience targeting, message timing, channel selection, and performance optimization. Includes real examples from successful campaigns.', 'Strategy', '{"campaigns","best-practices","optimization"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), 'published', 189, 24),
  ((SELECT id FROM organizations LIMIT 1), 'Audience Segmentation Guide', 'Effective audience segmentation is key to campaign success. Learn how to create dynamic segments based on behavior, demographics, and engagement. Includes templates for common segment types.', 'Audience', '{"segmentation","targeting","audience"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), 'published', 156, 15),
  ((SELECT id FROM organizations LIMIT 1), 'Multi-Channel Marketing Strategy', 'Discover how to coordinate campaigns across WhatsApp, Email, SMS, and social media. Learn the strengths of each channel and how to create cohesive cross-channel experiences.', 'Strategy', '{"multi-channel","integration","strategy"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1), 'published', 134, 12),
  ((SELECT id FROM organizations LIMIT 1), 'Analytics and Reporting', 'Understanding your marketing metrics is crucial for optimization. This guide explains key performance indicators, how to read analytics dashboards, and how to create custom reports.', 'Analytics', '{"analytics","reporting","metrics"}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1), 'published', 198, 21),
  ((SELECT id FROM organizations LIMIT 1), 'Content Studio Guide', 'The Content Studio helps you create, manage, and optimize marketing content. Learn how to use AI-powered content generation, templates, and performance tracking.', 'Content', '{"content-studio","creation","ai"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), 'published', 167, 19),
  ((SELECT id FROM organizations LIMIT 1), 'SEO Optimization Techniques', 'Improve your content visibility with these SEO techniques. Learn keyword research, on-page optimization, link building, and technical SEO fundamentals specific to educational content.', 'SEO', '{"seo","optimization","keywords"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1), 'published', 145, 16),
  ((SELECT id FROM organizations LIMIT 1), 'Marketing Calendar Setup', 'Effectively plan and schedule your marketing activities with the Marketing Calendar. Learn how to create events, set reminders, and coordinate team schedules.', 'Calendar', '{"calendar","planning","scheduling"}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1), 'published', 128, 14),
  ((SELECT id FROM organizations LIMIT 1), 'Integration Configuration', 'Connect your marketing tools and platforms. This guide covers integrating with Facebook, Google, WhatsApp, and other popular marketing platforms.', 'Technical', '{"integration","configuration","api"}', (SELECT id FROM users WHERE email='admin@electrobtech.com' LIMIT 1), 'published', 112, 11),
  ((SELECT id FROM organizations LIMIT 1), 'A/B Testing Framework', 'Systematically improve your campaign performance with A/B testing. Learn how to design experiments, measure statistical significance, and implement winning variations.', 'Optimization', '{"ab-testing","experimentation","optimization"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), 'published', 98, 13),
  ((SELECT id FROM organizations LIMIT 1), 'Social Media Marketing Tips', 'Maximize your social media impact with these proven strategies. Learn content creation, community management, influencer collaboration, and paid advertising techniques.', 'Social Media', '{"social-media","content","engagement"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), 'published', 176, 22),
  ((SELECT id FROM organizations LIMIT 1), 'Email Marketing Mastery', 'Create effective email campaigns that convert. Learn subject line optimization, email design, list management, and deliverability best practices.', 'Email', '{"email","marketing","conversion"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), 'published', 154, 17),
  ((SELECT id FROM organizations LIMIT 1), 'WhatsApp Marketing Guide', 'Leverage WhatsApp Business for customer engagement. Learn message templates, automation, broadcast lists, and compliance requirements.', 'WhatsApp', '{"whatsapp","messaging","automation"}', (SELECT id FROM users WHERE email='karan@electrobtech.com' LIMIT 1), 'published', 132, 15),
  ((SELECT id FROM organizations LIMIT 1), 'Budget Allocation Strategies', 'Optimize your marketing budget across channels and campaigns. Learn ROI analysis, budget forecasting, and performance-based allocation methods.', 'Finance', '{"budget","roi","finance"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), 'published', 87, 9),
  ((SELECT id FROM organizations LIMIT 1), 'Marketing Automation Workflows', 'Automate repetitive marketing tasks with workflows. Learn trigger setup, condition logic, personalization, and integration with other systems.', 'Automation', '{"automation","workflows","efficiency"}', (SELECT id FROM users WHERE email='priya@electrobtech.com' LIMIT 1), 'published', 103, 12)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Competitors (12 records) ----------
INSERT INTO mh_competitors (organization_id, name, domain, industry, channels, tracking_keywords, social_handles, metadata, is_active) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'TechEd Academy', 'techedacademy.com', 'Technology Education', ARRAY['email', 'social', 'paid_ads'], ARRAY['ai course', 'data science training', 'machine learning'], '{"twitter":"@techedacademy","linkedin":"teched-academy","instagram":"techedacademy"}', '{"founded":2018,"funding":"Series A","employees":"50-100"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'CodeMasters Institute', 'codemasters.in', 'Programming Training', ARRAY['email', 'whatsapp', 'youtube'], ARRAY['python course', 'web development', 'java training'], '{"youtube":"codemasters","facebook":"codemasters.institute"}', '{"founded":2015,"funding":"Bootstrapped","employees":"20-50"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'DataSkills Pro', 'dataskills.pro', 'Data Science Education', ARRAY['linkedin', 'email', 'blog'], ARRAY['data science', 'analytics', 'sql training'], '{"linkedin":"dataskills-pro","twitter":"@dataskillspro"}', '{"founded":2020,"funding":"Seed","employees":"10-20"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'AI Learning Hub', 'ailearninghub.com', 'AI/ML Training', ARRAY['youtube', 'instagram', 'paid_ads'], ARRAY['machine learning', 'deep learning', 'neural networks'], '{"youtube":"AIlearningHub","instagram":"ailearninghub"}', '{"founded":2019,"funding":"Series B","employees":"100-200"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'WebDev Academy', 'webdevacademy.io', 'Web Development', ARRAY['youtube', 'email', 'discord'], ARRAY['react', 'angular', 'vuejs', 'nodejs'], '{"youtube":"WebDevAcademy","discord":"webdevacademy"}', '{"founded":2017,"funding":"Series A","employees":"50-100"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'CloudCertify', 'cloudcertify.com', 'Cloud Computing', ARRAY['linkedin', 'email', 'blog'], ARRAY['aws certification', 'azure training', 'gcp course'], '{"linkedin":"cloudcertify","twitter":"@cloudcertify"}', '{"founded":2021,"funding":"Seed","employees":"10-20"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'SecurityFirst Training', 'securityfirst.edu', 'Cybersecurity', ARRAY['email', 'linkedin', 'webinars'], ARRAY['cybersecurity', 'ethical hacking', 'network security'], '{"linkedin":"securityfirst-training","twitter":"@securityfirst"}', '{"founded":2016,"funding":"Series A","employees":"50-100"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'MobileDev Institute', 'mobiledev.in', 'Mobile Development', ARRAY['youtube', 'instagram', 'email'], ARRAY['react native', 'flutter', 'android', 'ios'], '{"youtube":"MobileDevInstitute","instagram":"mobiledev.institute"}', '{"founded":2018,"funding":"Bootstrapped","employees":"20-50"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'DevOps School', 'devopsschool.com', 'DevOps Training', ARRAY['youtube', 'blog', 'email'], ARRAY['devops', 'docker', 'kubernetes', 'ci-cd'], '{"youtube":"DevOpsSchool","blog":"blog.devopsschool.com"}', '{"founded":2019,"funding":"Series A","employees":"50-100"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'Blockchain Academy', 'blockchainacademy.io', 'Blockchain Training', ARRAY['linkedin', 'twitter', 'email'], ARRAY['blockchain', 'cryptocurrency', 'web3', 'solidity'], '{"linkedin":"blockchain-academy","twitter":"@blockchainacad"}', '{"founded":2020,"funding":"Seed","employees":"10-20"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'Digital Marketing Pro', 'dmpro.training', 'Digital Marketing', ARRAY['instagram', 'facebook', 'email'], ARRAY['digital marketing', 'seo', 'social media marketing'], '{"instagram":"dmpro.training","facebook":"dmpro.training"}', '{"founded":2017,"funding":"Series B","employees":"100-200"}', true),
  ((SELECT id FROM organizations LIMIT 1), 'IoT Skills Academy', 'iotskills.com', 'IoT Training', ARRAY['youtube', 'email', 'webinars'], ARRAY['iot', 'embedded systems', 'arduino', 'raspberry pi'], '{"youtube":"IoTSkillsAcademy","linkedin":"iot-skills"}', '{"founded":2021,"funding":"Seed","employees":"10-20"}', true)
ON CONFLICT DO NOTHING;

-- ---------- Marketing Hub Competitor Analysis (15 records) ----------
INSERT INTO mh_competitor_analysis (competitor_id, analysis_type, metrics, insights, recommendations, analysis_date) VALUES
  ((SELECT id FROM mh_competitors WHERE name='TechEd Academy' LIMIT 1), 'seo', '{"keyword_rankings":45,"organic_traffic":125000,"backlinks":3200,"domain_authority":45}', '{"strengths":"Strong domain authority, good keyword coverage","weaknesses":"Content depth could be improved"}', ARRAY['Increase content depth on key topics','Build more high-quality backlinks','Improve page load speed'], '2024-11-01'),
  ((SELECT id FROM mh_competitors WHERE name='TechEd Academy' LIMIT 1), 'social', '{"followers":45000,"engagement_rate":3.2,"post_frequency":5,"growth_rate":12}', '{"strengths":"Consistent posting, good visual content","weaknesses":"Lower engagement compared to industry average"}', ARRAY['Increase interactive content','Use more video content','Improve response time to comments'], '2024-11-02'),
  ((SELECT id FROM mh_competitors WHERE name='CodeMasters Institute' LIMIT 1), 'content', '{"blog_posts":85,"video_content":120,"content_quality":7.2,"update_frequency":"weekly"}', '{"strengths":"High volume of content","weaknesses":"Content quality varies significantly"}', ARRAY['Focus on quality over quantity','Standardize content templates','Implement content review process'], '2024-11-03'),
  ((SELECT id FROM mh_competitors WHERE name='DataSkills Pro' LIMIT 1), 'ads', '{"ad_spend":25000,"impressions":2500000,"clicks":45000,"ctr":1.8}', '{"strengths":"Good ad spend efficiency","weaknesses":"Limited ad creative variation"}', Array['Test more ad creatives','Expand to more platforms','Optimize landing pages'], '2024-11-04'),
  ((SELECT id FROM mh_competitors WHERE name='AI Learning Hub' LIMIT 1), 'pricing', '{"course_prices":{"min":15000,"max":45000,"average":28000},"discount_frequency":"quarterly","bundle_offers":true}', '{"strengths":"Competitive pricing, good bundle deals","weaknesses":"Frequent discounts may devalue brand"}', Array['Reduce discount frequency','Focus on value proposition','Create premium tier'], '2024-11-05'),
  ((SELECT id FROM mh_competitors WHERE name='WebDev Academy' LIMIT 1), 'features', '{"platform_features":{"community":true,"mentoring":true,"projects":true,"certification":true},"unique_features":["discord_community","code_review"]}', '{"strengths":"Strong community features","weaknesses":"Limited mentorship availability"}', Array['Scale mentorship program','Add live sessions','Improve project variety'], '2024-11-06'),
  ((SELECT id FROM mh_competitors WHERE name='CloudCertify' LIMIT 1), 'seo', '{"keyword_rankings":32,"organic_traffic":89000,"backlinks":1800,"domain_authority":38}', '{"strengths":"Good technical SEO","weaknesses":"Limited content volume"}', Array['Increase content production','Build more internal links','Optimize for featured snippets'], '2024-11-07'),
  ((SELECT id FROM mh_competitors WHERE name='SecurityFirst Training' LIMIT 1), 'social', '{"followers":28000,"engagement_rate":4.5,"post_frequency":4,"growth_rate":18}', '{"strengths":"High engagement rate","weaknesses":"Slower follower growth"}', Array['Increase posting frequency','Collaborate with industry influencers','Run follower campaigns'], '2024-11-08'),
  ((SELECT id FROM mh_competitors WHERE name='MobileDev Institute' LIMIT 1), 'content', '{"blog_posts":45,"video_content":200,"content_quality":8.1,"update_frequency":"bi-weekly"}', '{"strengths":"Excellent video content","weaknesses":"Limited written content"}', Array['Expand blog content','Repurpose video content','Create content series'], '2024-11-09'),
  ((SELECT id FROM mh_competitors WHERE name='DevOps School' LIMIT 1), 'ads', '{"ad_spend":18000,"impressions":1800000,"clicks":36000,"ctr":2.0}', '{"strengths":"Good CTR, efficient spend","weaknesses":"Limited ad targeting options"}', Array['Expand audience targeting','Test different ad formats','Improve ad copy'], '2024-11-10'),
  ((SELECT id FROM mh_competitors WHERE name='Blockchain Academy' LIMIT 1), 'pricing', '{"course_prices":{"min":20000,"max":55000,"average":35000},"discount_frequency":"monthly","bundle_offers":false}', '{"strengths":"Premium positioning","weaknesses":"Higher prices may limit market"}', Array['Create mid-tier pricing','Add payment plans','Bundle with certification'], '2024-11-11'),
  ((SELECT id FROM mh_competitors WHERE name='Digital Marketing Pro' LIMIT 1), 'features', '{"platform_features":{"community":false,"mentoring":true,"projects":true,"certification":true},"unique_features":["live_sessions","case_studies"]}', '{"strengths":"Strong practical focus","weaknesses":"No community features"}', Array['Add community features','Create peer learning groups','Implement alumni network'], '2024-11-12'),
  ((SELECT id FROM mh_competitors WHERE name='IoT Skills Academy' LIMIT 1), 'seo', '{"keyword_rankings":28,"organic_traffic":67000,"backlinks":1200,"domain_authority":32}', '{"strengths":"Niche keyword dominance","weaknesses":"Limited overall traffic"}', Array['Expand keyword targets','Build authority in broader topics','Increase content production'], '2024-11-13'),
  ((SELECT id FROM mh_competitors WHERE name='TechEd Academy' LIMIT 1), 'content', '{"blog_posts":120,"video_content":85,"content_quality":7.8,"update_frequency":"weekly"}', '{"strengths":"Consistent content production","weaknesses":"Content distribution could be improved"}', Array['Improve content distribution','Repurpose content across platforms','Create content series'], '2024-11-14'),
  ((SELECT id FROM mh_competitors WHERE name='CodeMasters Institute' LIMIT 1), 'social', '{"followers":32000,"engagement_rate":2.8,"post_frequency":6,"growth_rate":15}', '{"strengths":"Consistent posting schedule","weaknesses":"Below-average engagement"}', Array['Improve content quality','Increase interactive elements','Use more user-generated content'], '2024-11-15')
ON CONFLICT DO NOTHING;
