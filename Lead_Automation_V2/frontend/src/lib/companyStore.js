'use client';

// Shared localStorage-backed data store for companies + audit logs.
//
// Why this exists: the Super Admin "Companies" table, the row Edit modal,
// and the public/company registration form all need to read and write the
// *same* records and have changes show up in each other immediately —
// including across a full page refresh. Keeping three separate copies of
// this data (or worse, three `useState([...])` calls seeded with the same
// dummy array) is exactly how registrations/edits get silently wiped on
// reload. This module is the one place that owns persistence.
//
// Swap-to-backend note: every function below is written the same shape a
// real API call would have (id in, patch in, promise/object out) so
// `lib/queries/superAdmin.js` can swap these for real `call(...)` requests
// later without touching the components that consume the hooks.

const COMPANIES_KEY = 'connectsphere.companies.v1';
const AUDIT_LOG_KEY = 'connectsphere.auditLogs.v1';

// Default seed data — same four tenants the Companies page already
// shipped with, now carrying the fuller registration field set. This is
// ONLY ever written to localStorage the first time it's empty; it never
// overwrites what's already there, so refreshes never clobber real edits
// or new registrations.
const SEED_COMPANIES = [
  {
    id: 'org_electrobtech',
    name: 'Electrobtech Innovations',
    email: 'contact@electrobtech.com',
    industry: 'Technology',
    plan: 'starter',
    contactPerson: 'Riya Sharma',
    phone: '+91 98765 43210',
    address: 'Bengaluru, Karnataka, India',
    registeredAt: '2026-08-01T00:00:00Z',
    status: 'pending',
  },
  {
    id: 'org_aura_dynamics',
    name: 'Aura Dynamics',
    email: 'admin@auradynamics.io',
    industry: 'Healthcare',
    plan: 'pro',
    contactPerson: 'Devansh Rao',
    phone: '+91 98450 11223',
    address: 'Hyderabad, Telangana, India',
    registeredAt: '2026-07-28T00:00:00Z',
    status: 'active',
  },
  {
    id: 'org_apex_retail',
    name: 'Apex Retail Labs',
    email: 'info@apexretail.com',
    industry: 'E-commerce',
    plan: 'enterprise',
    contactPerson: 'Meera Nair',
    phone: '+91 90080 76655',
    address: 'Mumbai, Maharashtra, India',
    registeredAt: '2026-06-15T00:00:00Z',
    status: 'active',
  },
  {
    id: 'org_nexus_logistics',
    name: 'Nexus Logistics',
    email: 'ops@nexuslogistics.com',
    industry: 'Logistics',
    plan: 'pro',
    contactPerson: 'Arjun Mehta',
    phone: '+91 99000 22114',
    address: 'Pune, Maharashtra, India',
    registeredAt: '2026-05-22T00:00:00Z',
    status: 'active',
  },
];

const SEED_AUDIT_LOGS = [
  {
    id: 'log_seed_1',
    created_at: '2026-08-01T10:30:00Z',
    organization_name: 'Electrobtech Innovations',
    action: 'company.registered',
    meta: { description: 'New company Electrobtech Innovations registered' },
  },
  {
    id: 'log_seed_2',
    created_at: '2026-07-20T12:00:00Z',
    organization_name: 'Zenith Cloud Systems',
    action: 'wallet.recharge',
    meta: { description: 'Recharged ₹1,20,000 to wallet' },
  },
];

const isBrowser = () => typeof window !== 'undefined';

function readJSON(key, fallback) {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    // Corrupt/blocked storage — fall back rather than crash the page.
    return null;
  }
}

function writeJSON(key, value) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/blocked (private browsing etc.) — the in-memory value
    // this tick still works, it just won't survive a refresh.
  }
}

function ensureSeeded() {
  if (readJSON(COMPANIES_KEY, null) === null) {
    writeJSON(COMPANIES_KEY, SEED_COMPANIES);
  }
  if (readJSON(AUDIT_LOG_KEY, null) === null) {
    writeJSON(AUDIT_LOG_KEY, SEED_AUDIT_LOGS);
  }
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function appendAuditLog({ organizationName, action, description }) {
  const logs = readJSON(AUDIT_LOG_KEY, SEED_AUDIT_LOGS) ?? [];
  const entry = {
    id: genId('log'),
    created_at: new Date().toISOString(),
    organization_name: organizationName,
    action,
    meta: { description },
  };
  writeJSON(AUDIT_LOG_KEY, [entry, ...logs]);
  return entry;
}

// ---- Public API -----------------------------------------------------

export function getCompanies() {
  ensureSeeded();
  return readJSON(COMPANIES_KEY, SEED_COMPANIES) ?? [];
}

export function getAuditLogs() {
  ensureSeeded();
  return readJSON(AUDIT_LOG_KEY, SEED_AUDIT_LOGS) ?? [];
}

// Appends a newly-registered company (immutable: never mutates the
// existing array, always returns a fresh one — new record goes first so
// it shows up at the top of the table right away).
export function registerCompany(input) {
  const companies = getCompanies();
  const company = {
    id: genId('org'),
    name: input.name?.trim() || 'Untitled Company',
    email: input.email?.trim() || '',
    industry: input.industry?.trim() || '',
    plan: input.plan || 'starter',
    contactPerson: input.contactPerson?.trim() || '',
    phone: input.phone?.trim() || '',
    address: input.address?.trim() || '',
    registeredAt: new Date().toISOString(),
    status: input.status || 'pending',
  };
  writeJSON(COMPANIES_KEY, [company, ...companies]);
  appendAuditLog({
    organizationName: company.name,
    action: 'company.registered',
    description: `New company ${company.name} registered`,
  });
  return company;
}

// Patches an existing company's editable fields. Uses `.map()` so the
// array reference and every untouched row's object identity change as
// little as possible — the standard immutable-update pattern React needs
// to reliably re-render.
export function updateCompany(id, patch) {
  const companies = getCompanies();
  const existing = companies.find((c) => c.id === id);
  if (!existing) throw new Error('Company not found');

  const updated = { ...existing, ...patch, id: existing.id };
  writeJSON(COMPANIES_KEY, companies.map((c) => (c.id === id ? updated : c)));
  appendAuditLog({
    organizationName: updated.name,
    action: 'company.updated',
    description: `Updated details for ${updated.name}`,
  });
  return updated;
}

// Status changes go through their own function (rather than generic
// updateCompany) purely so the audit description can name the specific
// from → to transition, e.g. "Changed status of X from pending to active".
export function updateCompanyStatus(id, nextStatus) {
  const companies = getCompanies();
  const existing = companies.find((c) => c.id === id);
  if (!existing) throw new Error('Company not found');
  if (existing.status === nextStatus) return existing;

  const prevStatus = existing.status;
  const updated = { ...existing, status: nextStatus };
  writeJSON(COMPANIES_KEY, companies.map((c) => (c.id === id ? updated : c)));
  appendAuditLog({
    organizationName: updated.name,
    action: 'company.status_updated',
    description: `Changed status of ${updated.name} from ${prevStatus} to ${nextStatus}`,
  });
  return updated;
}