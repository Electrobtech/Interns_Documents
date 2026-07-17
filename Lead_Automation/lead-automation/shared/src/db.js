const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

// Single shared pool factory. Each service imports this and gets a
// connection to the same Postgres instance (schema is shared).
const rawPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

rawPool.on('error', (err) => console.error('Unexpected PG error', err));

// ---------------------------------------------------------------------
// Row-Level Security support (see infra/db/rls.sql for the policies).
//
// RLS policies check a Postgres session variable (`app.current_org`) that
// has to be set on the *specific connection* running a query. A plain
// `pg.Pool` hands out whichever idle connection is free, so if we just did
// `pool.query("SET app.current_org = ...")` once, it could leak onto a
// completely different request's connection later. AsyncLocalStorage fixes
// this: withTenantScope() pins one connection to the current request's
// async context, and the `pool.query(...)` wrapper below transparently
// uses that pinned connection instead of a random one, whenever we're
// inside such a scope. Existing route handlers don't need to change at
// all — they keep calling pool.query() exactly as before.
// ---------------------------------------------------------------------

const als = new AsyncLocalStorage();

const pool = {
  query: (...args) => {
    const client = als.getStore()?.client;
    return (client || rawPool).query(...args);
  },
};

/**
 * Pins a connection to the current async context, tags it with the given
 * organization id for RLS, runs `fn`, then always untags + releases the
 * connection — even on error. Every pool.query() call made anywhere inside
 * fn's call graph during this window is transparently routed to this
 * connection.
 *
 * Used by shared/src/auth.js's `authenticate` middleware for every
 * authenticated request, so individual route handlers never need to call
 * this themselves.
 */
async function withTenantScope(organizationId, fn) {
  const client = await rawPool.connect();
  try {
    await client.query('SELECT set_config($1, $2, false)', ['app.current_org', String(organizationId || '')]);
    return await als.run({ client }, fn);
  } finally {
    await client.query("SELECT set_config('app.current_org', '', false)").catch(() => {});
    client.release();
  }
}

/**
 * Escape hatch for the handful of routes that legitimately need to read or
 * write across tenants before a tenant context exists — right now that's
 * only auth-service's /auth/register (creating a brand-new org) and
 * /auth/login (finding a user by email before we know their org). See
 * infra/db/rls.sql's app_rls_bypass() policy check.
 *
 * Anything wrapped in this bypasses row-level security entirely, so keep
 * its use to those two call sites — don't reach for it just to make an
 * inconvenient query pass.
 */
async function withSystemAccess(fn) {
  const client = await rawPool.connect();
  try {
    await client.query("SELECT set_config('app.rls_bypass', 'on', false)");
    return await als.run({ client }, fn);
  } finally {
    await client.query("SELECT set_config('app.rls_bypass', '', false)").catch(() => {});
    client.release();
  }
}

module.exports = { pool, rawPool, withTenantScope, withSystemAccess };
