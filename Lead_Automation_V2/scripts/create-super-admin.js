#!/usr/bin/env node
// scripts/create-super-admin.js
//
// One-off provisioning script for platform_admins. There's no public
// signup route for Super Admin accounts (unlike /auth/register for
// tenants) — staff access is deliberately out-of-band, created by
// someone who already has database access, not self-served.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/create-super-admin.js \
//     --name "Jane Doe" --email jane@yourcompany.com --password 'S0meStrongPass!'

const bcrypt = require('bcryptjs');
const { pool, withSystemAccess } = require('../shared/src/db');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    out[key] = argv[i + 1];
  }
  return out;
}

async function main() {
  const { name, email, password } = parseArgs(process.argv.slice(2));
  if (!name || !email || !password) {
    console.error('Usage: node scripts/create-super-admin.js --name "..." --email ... --password ...');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  // platform_admins is only ever reachable under withSystemAccess() (see
  // its bypass_only RLS policy in infra/db/rls.sql) — a plain pool.query()
  // outside a scope would just get zero rows / a rejected insert.
  await withSystemAccess(async () => {
    const { rows } = await pool.query(
      `INSERT INTO platform_admins (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
       RETURNING id, email`,
      [name, email.trim().toLowerCase(), hash]
    );
    console.log(`Super admin ready: ${rows[0].email} (${rows[0].id})`);
  });

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
