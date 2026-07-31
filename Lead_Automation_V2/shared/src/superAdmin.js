// shared/src/superAdmin.js
//
// Auth for platform_admins — mirrors shared/src/auth.js's authenticate()
// shape (same JWT signing via `sign`/`verify`), but pins the request to
// withSystemAccess() instead of withTenantScope(organizationId), since a
// super admin isn't inside any single tenant and platform_admins itself
// carries no organization_id (see 021_super_admin_billing.sql and the
// bypass_only RLS policy in infra/db/rls.sql).
//
// Token payload shape: { adminId, email, isSuperAdmin: true }
// (deliberately no organizationId, so it can never be mistaken for /
// reused as a tenant `authenticate()` token — that middleware requires
// user.organizationId and will reject this one outright.)

const { sign, verify } = require('./auth');
const { withSystemAccess } = require('./db');
const { logAuditRaw } = require('./audit');

function signSuperAdminToken({ adminId, email }) {
  return sign({ adminId, email, isSuperAdmin: true });
}

function requireSuperAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let admin;
  try {
    admin = verify(token);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (!admin.isSuperAdmin || !admin.adminId) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  req.admin = admin;

  withSystemAccess(() => new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    next();
  })).catch((err) => {
    if (!res.headersSent) next(err);
    else console.error('[superAdmin] error after response sent', err.message);
  });
}

// Convenience wrapper around logAuditRaw for platform-level actions
// (suspend a tenant, manual wallet top-up, toggle a feature flag).
// organization_id is the *target* tenant being acted on, not the
// admin's own tenant (they have none); the admin's identity goes in
// meta since audit_logs.user_id is an FK into `users`, not
// `platform_admins`.
function logSuperAdminAction(req, organizationId, action, meta = {}) {
  return logAuditRaw(organizationId, null, action, { ...meta, platformAdminId: req.admin?.adminId });
}

module.exports = { signSuperAdminToken, requireSuperAdmin, logSuperAdminAction };
