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
const { withSystemAccess, pool } = require('./db');
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

/**
 * Enforces role-based access control (RBAC) for platform admins.
 * Must be used on routes behind `requireSuperAdmin` where `req.admin` is populated.
 *
 * @param {...string} allowedRoles - Acceptable roles (e.g., 'super_admin', 'billing_admin')
 */
function requirePlatformRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.admin || !req.admin.adminId) {
      return res.status(401).json({ error: 'Super admin access required' });
    }

    try {
      // Lazy-load admin role if it wasn't pre-loaded on req.admin
      if (!req.admin.role) {
        const { rows } = await pool.query(
          `SELECT role, status FROM platform_admins WHERE id = $1 LIMIT 1`,
          [req.admin.adminId]
        );
        if (!rows.length || rows[0].status !== 'active') {
          return res.status(403).json({ error: 'Platform admin account is inactive' });
        }
        req.admin.role = rows[0].role;
      }

      if (!allowedRoles.includes(req.admin.role)) {
        return res.status(403).json({
          error: `Forbidden: Action requires one of the following roles: ${allowedRoles.join(', ')}`,
        });
      }

      next();
    } catch (err) {
      console.error('[requirePlatformRole] error verifying role:', err.message);
      res.status(500).json({ error: 'Internal server error during authorization' });
    }
  };
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

module.exports = {
  signSuperAdminToken,
  requireSuperAdmin,
  requirePlatformRole,
  logSuperAdminAction,
};