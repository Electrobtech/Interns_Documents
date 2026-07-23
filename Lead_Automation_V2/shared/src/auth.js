const jwt = require('jsonwebtoken');
const { withTenantScope } = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

// Sign a token carrying tenant + role context.
function sign(payload) {
  return jwt.sign(payload, SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

// Verify + decode a token signed with sign(). Throws if invalid/expired —
// callers that need a boolean/try-catch (e.g. OAuth 'state' round-trips
// that can't carry an Authorization header) wrap this themselves.
function verify(token, opts) {
  return jwt.verify(token, SECRET, opts);
}

// Express middleware: verifies JWT, attaches req.user, and pins the rest
// of the request to a single tenant-scoped DB connection (withTenantScope,
// see shared/src/db.js) so Postgres RLS policies (infra/db/rls.sql)
// restrict every query the route handler makes to that org's rows — even
// if the handler's SQL forgot a WHERE organization_id = ... clause.
// req.user = { userId, organizationId, role }
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let user;
  try {
    user = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  req.user = user;

  if (!user.organizationId) {
    return res.status(401).json({ error: 'Token missing tenant context' });
  }

  // next() kicks off the rest of the middleware chain / route handler
  // synchronously, but that handler is typically async and Express does
  // not await it — so we keep the AsyncLocalStorage-pinned connection
  // alive (and hence the tenant scope active) until the response has
  // actually finished, rather than resolving as soon as next() returns.
  withTenantScope(user.organizationId, () => new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    next();
  })).catch((err) => {
    if (!res.headersSent) next(err);
    else console.error('[auth] error after response sent', err.message);
  });
}

// Role guard. Usage: requireRole('admin', 'manager')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { sign, verify, authenticate, requireRole, SECRET };