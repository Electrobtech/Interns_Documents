const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

// Single shared pool factory. Each service imports this and gets a
// connection to the same Postgres instance (schema is shared). Services
// connect as `app_user` (see docker-compose.yml / infra/db/00-app-role.sh),
// a deliberately non-superuser role — Postgres RLS policies (infra/db/rls.sql)
// are never enforced against a table's owner or a superuser, so the isolation
// below only actually does anything because of that role choice.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => console.error('Unexpected PG error', err));

// Holds the single Postgres client pinned to the current request/job, if
// any. A plain pool.query() hands out whichever idle connection happens to
// be free, so a naive `SET app.current_org` on one query could leak onto a
// completely different request's connection later. AsyncLocalStorage fixes
// that: withTenantScope()/withSystemAccess() check out ONE connection, tag
// it, and keep every query anywhere in that call graph — including deeper
// awaited async calls — pinned to it for the duration.
const tenantContext = new AsyncLocalStorage();

// Transparently route pool.query() through the pinned connection when
// we're inside a scope, so existing call sites (`pool.query(...)`
// everywhere in every service) don't need to change to get RLS-aware
// behavior. Outside any scope, this falls back to a normal pool query —
// which, since it gets a connection with no app.current_org set, the RLS
// policies fail closed on (zero rows), by design (see infra/db/rls.sql).
const rawQuery = pool.query.bind(pool);
pool.query = (...args) => {
  const client = tenantContext.getStore();
  if (client) return client.query(...args);
  return rawQuery(...args);
};

async function runScoped(setConfigSql, setConfigParams, fn) {
  const client = await pool.connect();
  try {
    await client.query(setConfigSql, setConfigParams);
    return await tenantContext.run(client, fn);
  } finally {
    // Always clear the session GUCs before the connection goes back to the
    // pool. pg's pool reuses raw sockets across unrelated requests — a
    // leftover app.current_org (or app.rls_bypass) would silently scope
    // (or de-scope) whatever the *next* checkout happens to be.
    try {
      await client.query(
        `SELECT set_config('app.current_org', '', false), set_config('app.rls_bypass', '', false)`
      );
    } catch (e) {
      console.error('[db] failed to reset session GUCs', e.message);
    }
    client.release();
  }
}

// Pin one connection to `organizationId` for the duration of `fn`. Every
// pool.query() call anywhere inside fn's call graph transparently runs on
// this connection, with Postgres RLS policies restricting every read and
// write to that tenant's rows — even if the calling code forgot a
// `WHERE organization_id = ...` clause.
//
// Called automatically by shared/src/auth.js's `authenticate` middleware
// for every authenticated request. Route handlers should not normally call
// this themselves.
function withTenantScope(organizationId, fn) {
  if (!organizationId) {
    return Promise.reject(new Error('withTenantScope requires an organizationId'));
  }
  return runScoped(`SELECT set_config('app.current_org', $1, false)`, [String(organizationId)], fn);
}

// Sets app.rls_bypass = on instead of a tenant id — the only sanctioned way
// to cross tenant boundaries (see docs/MULTI_TENANT_RLS.md §2.5 for the
// full, intentionally short list of call sites: org registration and
// cross-org login/verification lookups, before a tenant context exists).
//
// Grep check to confirm nothing else bypasses RLS:
//   grep -rn "withSystemAccess" --include="*.js" services/ shared/
function withSystemAccess(fn) {
  return runScoped(`SELECT set_config('app.rls_bypass', 'on', false)`, [], fn);
}

module.exports = { pool, withTenantScope, withSystemAccess };