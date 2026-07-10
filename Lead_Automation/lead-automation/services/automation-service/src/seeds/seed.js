// One-off loader for the example playbooks bundled in this folder
// (project-details-flow.json, throttle-example-flow.json) — run with
// `npm run seed` from services/automation-service. Without this, the
// engine has no active playbook rows to resolve, so
// POST /automation/session/simulate and real inbound webhooks will 404
// with "No active playbook..." and the Diagnostic Bench UI will just keep
// falling back to its offline mock walk.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const playbookRepository = require('../repositories/playbookRepository');

// The bundled JSON files ship with a placeholder demo clientId
// ("client_882") that predates the CRM's organizations table and won't
// satisfy the organization_id foreign key on the playbooks table. Default
// to the demo organization seeded by infra/db/seed.sql (Electrobtech
// Innovations) so `npm run seed` works out of the box against a freshly
// bootstrapped database; override with a real organization id via
// `npm run seed -- <organization-uuid>` to seed against a different org.
const DEMO_ORG_ID = '11111111-1111-1111-1111-111111111111';

async function main() {
  const clientIdOverride = process.argv[2] || DEMO_ORG_ID;

  const dir = __dirname;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8').trim();
    if (!raw) {
      console.warn(`Skipping ${file}: empty file`);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn(`Skipping ${file}: invalid JSON (${err.message})`);
      continue;
    }

    const { _id, createdAt, updatedAt, ...doc } = parsed;
    doc.id = _id;
    doc.clientId = clientIdOverride;

    const saved = await playbookRepository.upsertFromSeed(doc);
    console.log(`Seeded playbook "${saved.name}" (id ${saved.id}, clientId ${saved.clientId})`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
