-- 033_mock_google_reviews.sql
--
-- Google Business Profile API access is temporarily unavailable, so this
-- seeds mock Google reviews into the SAME google_locations / google_reviews
-- tables used by the real integration (see 004_google_reviews.sql and
-- services/review-service/src/google/). No schema change is needed — the
-- existing tables already have every column mock data needs.
--
-- The mock location is flagged purely by convention: its location_id /
-- account_id are prefixed "mock-". services/review-service/src/google/
-- routes.js checks for that prefix to skip real Google API calls (OAuth
-- token lookup, googleApi.updateReply/deleteReply) for this location, so
-- replying works without a live Google connection. Once real API access
-- is restored, delete these rows (or just connect a real account and
-- select a different location) and nothing else needs to change.
--
-- This file is idempotent — INSERTs are guarded by the tables' existing
-- UNIQUE constraints via ON CONFLICT DO NOTHING, so it's safe to run
-- against a database that already has this data (e.g. re-running after a
-- git pull). It only seeds the demo organization used throughout
-- infra/db/seed.sql — Electrobtech Innovations.
--
-- Run by hand against any database that was already initialized before
-- this change (fresh databases get this automatically — see seed.sql):
--   psql "$DATABASE_URL" -f infra/db/migrations/033_mock_google_reviews.sql

DO $$
DECLARE
  org_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN

  -- ---------- Mock account + location ----------
  INSERT INTO google_accounts (organization_id, account_id, account_name)
  VALUES (org_id, 'accounts/mock-electrobtech', 'Electrobtech Innovations (Mock)')
  ON CONFLICT (organization_id, account_id) DO NOTHING;

  INSERT INTO google_locations (organization_id, account_id, location_id, location_name, address, phone, is_selected)
  VALUES (
    org_id, 'accounts/mock-electrobtech', 'locations/mock-electrobtech-1',
    'Electrobtech Innovations — HSR Layout', 'HSR Layout, Bengaluru, Karnataka, India',
    '+91 80 4000 1234', true
  )
  ON CONFLICT (organization_id, location_id) DO NOTHING;

  -- ---------- Mock reviews (18, mixed ratings, some already replied) ----------
  INSERT INTO google_reviews (
    organization_id, location_id, review_id, reviewer_name, reviewer_photo_url,
    star_rating, comment, create_time, update_time, reply_comment, reply_update_time
  ) VALUES
    (org_id, 'locations/mock-electrobtech-1', 'mock-review-01', 'Rohan Verma',   'https://i.pravatar.cc/150?img=11',
     5, 'Excellent service! The team was quick to respond and resolved my issue same day.',
     now() - interval '2 days', now() - interval '2 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-02', 'Sana Iyer',     'https://i.pravatar.cc/150?img=32',
     4, 'Good products and fast delivery. Packaging could be a little sturdier.',
     now() - interval '4 days', now() - interval '3 days',
     'Thanks for the feedback, Sana! We are working on improving our packaging.', now() - interval '3 days'),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-03', 'Arjun Mehta',   'https://i.pravatar.cc/150?img=13',
     2, 'Delivery was late and the packaging was damaged when it arrived.',
     now() - interval '6 days', now() - interval '6 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-04', 'Priya Nair',    'https://i.pravatar.cc/150?img=25',
     5, 'Absolutely love this store! Staff are friendly and very knowledgeable.',
     now() - interval '8 days', now() - interval '7 days',
     'Thank you so much, Priya — see you again soon!', now() - interval '7 days'),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-05', 'Karan Malhotra','https://i.pravatar.cc/150?img=14',
     3, 'Decent experience overall, nothing extraordinary. Prices are a bit high.',
     now() - interval '10 days', now() - interval '10 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-06', 'Neha Patel',    'https://i.pravatar.cc/150?img=47',
     5, 'Best customer support I have experienced in a long time. Highly recommend!',
     now() - interval '12 days', now() - interval '11 days',
     'We really appreciate this, Neha! Thank you for the kind words.', now() - interval '11 days'),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-07', 'Vikram Rao',    'https://i.pravatar.cc/150?img=15',
     1, 'Very disappointed. The product I received did not match the description at all.',
     now() - interval '14 days', now() - interval '14 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-08', 'Ananya Singh',  'https://i.pravatar.cc/150?img=44',
     4, 'Great range of products. Checkout took a little longer than expected.',
     now() - interval '16 days', now() - interval '16 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-09', 'Rahul Deshmukh','https://i.pravatar.cc/150?img=18',
     5, 'Five stars for the quick turnaround and professional communication throughout.',
     now() - interval '18 days', now() - interval '17 days',
     'Thank you, Rahul! Glad we could help.', now() - interval '17 days'),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-10', 'Ishita Kapoor', 'https://i.pravatar.cc/150?img=29',
     2, 'The item arrived fine but customer service was slow to respond to my query.',
     now() - interval '20 days', now() - interval '20 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-11', 'Aditya Sharma', 'https://i.pravatar.cc/150?img=16',
     5, 'Impressed with the quality and the attention to detail. Will be back!',
     now() - interval '23 days', now() - interval '22 days',
     'That means a lot to us, Aditya — thank you!', now() - interval '22 days'),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-12', 'Meera Joshi',   'https://i.pravatar.cc/150?img=48',
     3, 'Average experience. The store was clean but the staff seemed understaffed.',
     now() - interval '26 days', now() - interval '26 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-13', 'Siddharth Rao', 'https://i.pravatar.cc/150?img=17',
     4, 'Solid experience overall. Would appreciate more payment options at checkout.',
     now() - interval '29 days', now() - interval '29 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-14', 'Tanvi Shah',    'https://i.pravatar.cc/150?img=45',
     5, 'Outstanding! They went above and beyond to make sure I was happy with my order.',
     now() - interval '33 days', now() - interval '32 days',
     'Thank you, Tanvi! We are thrilled to hear that.', now() - interval '32 days'),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-15', 'Farhan Khan',   'https://i.pravatar.cc/150?img=19',
     1, 'Ordered two weeks ago and still waiting on a resolution. Not happy.',
     now() - interval '36 days', now() - interval '36 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-16', 'Divya Menon',   'https://i.pravatar.cc/150?img=49',
     4, 'Really happy with my purchase. Delivery tracking could be more accurate though.',
     now() - interval '40 days', now() - interval '40 days', NULL, NULL),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-17', 'Gaurav Chawla', 'https://i.pravatar.cc/150?img=20',
     5, 'Consistently great service every time I visit. Keep it up!',
     now() - interval '44 days', now() - interval '43 days',
     'Thanks for being a loyal customer, Gaurav!', now() - interval '43 days'),

    (org_id, 'locations/mock-electrobtech-1', 'mock-review-18', 'Kavya Reddy',   'https://i.pravatar.cc/150?img=26',
     3, 'Products are good but the website was a bit confusing to navigate.',
     now() - interval '48 days', now() - interval '48 days', NULL, NULL)

  ON CONFLICT (organization_id, review_id) DO NOTHING;

END $$;
