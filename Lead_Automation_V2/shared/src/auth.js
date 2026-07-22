const jwt = require('jsonwebtoken');

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

// Express middleware: verifies JWT and attaches req.user.
// req.user = { userId, organizationId, role }
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
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
