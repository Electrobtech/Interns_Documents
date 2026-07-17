const jwt = require('jsonwebtoken');
const { withTenantScope } = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

// Sign a token carrying tenant + role context.
function sign(payload) {
  return jwt.sign(payload, SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

// Express middleware: verifies JWT, attaches req.user, and pins the rest
// of this request's DB queries to a connection tagged for req.user's
// organization (see shared/src/db.js + infra/db/rls.sql) — a database-level
// backstop so a route handler that forgets a `WHERE organization_id = ...`
// clause can no longer leak another tenant's rows.
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

  // Keep the tenant-scoped connection pinned for the whole request/response
  // cycle (not just until `next()` returns synchronously), since the actual
  // route handler's queries usually run after this call returns.
  withTenantScope(user.organizationId, () => new Promise((resolve) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    next();
  })).catch(next);
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

module.exports = { sign, authenticate, requireRole, SECRET };