-- Seed roles, a demo org, and an admin user.
-- Password for admin@electrobtech.com is: Admin@123
-- (bcrypt hash generated with cost 10)
INSERT INTO roles (name, description) VALUES
  ('admin',   'Full access'),
  ('manager', 'Manage team and campaigns'),
  ('agent',   'Handle conversations')
ON CONFLICT (name) DO NOTHING;

INSERT INTO organizations (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Electrobtech Innovations', 'electrobtech')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (organization_id, role_id, name, email, password_hash)
SELECT
  '11111111-1111-1111-1111-111111111111',
  (SELECT id FROM roles WHERE name='admin'),
  'Arjun Kumar',
  'admin@electrobtech.com',
  '$2b$10$vg0wERwhYziH8IvNSL.0nOq1wyeByQqhTkd.1H/oSDIVLPyErkG9m'
ON CONFLICT (organization_id, email) DO NOTHING;

-- Demo contacts / conversations for the inbox & dashboard
INSERT INTO contacts (organization_id, name, email, source) VALUES
  ('11111111-1111-1111-1111-111111111111','Rohan Verma','rohan@example.com','whatsapp'),
  ('11111111-1111-1111-1111-111111111111','Ananya Singh','ananya@example.com','instagram'),
  ('11111111-1111-1111-1111-111111111111','Neha Patel','neha@example.com','webchat')
ON CONFLICT DO NOTHING;
