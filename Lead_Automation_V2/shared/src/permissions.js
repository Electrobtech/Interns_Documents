const { pool } = require('./db');

// Permission codes are embedded in the JWT at login/register (see auth-service),
// so this middleware is a pure in-memory check — no DB roundtrip per request.
function requirePermission(code) {
  return (req, res, next) => {
    const perms = req.user?.permissions || [];
    if (!perms.includes(code)) {
      return res.status(403).json({ error: `Missing permission: ${code}` });
    }
    next();
  };
}

async function permissionsForRoleId(roleId) {
  if (!roleId) return [];
  const { rows } = await pool.query(
    `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = $1`,
    [roleId]
  );
  return rows.map((r) => r.code);
}

module.exports = { requirePermission, permissionsForRoleId };
