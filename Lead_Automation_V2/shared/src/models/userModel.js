// shared/src/models/userModel.js
//
// Data-access layer for `users` (tenant staff), used by the Super
// Admin's Team & Agent Performance views. Same rationale as
// companyModel.js: raw pg, ORM-shaped functions, meant to run under
// withSystemAccess() since a super admin reads across every tenant.
// Row-level password_hash is never selected here.
//
// NOTE: `users` has no `role` or `status` column directly — role lives
// on `roles` (joined via role_id), and the closest thing to a status is
// `availability` (online/away/offline), not a role/account status. Fixed
// after the first version of this file assumed columns that don't exist
// and 500'd on the first real request against app_user.

const { pool } = require('../db');

const SAFE_COLUMNS = `
  u.id, u.organization_id, u.name, u.email, r.name AS role, u.availability, u.created_at
`;

// Role/availability breakdown per company — section B "Role Breakdown".
// Returns one row per (role, availability) with a count, so the caller
// can pivot into "N sales agents / M marketing agents" etc.
async function roleBreakdownByOrg(organizationId) {
  const { rows } = await pool.query(
    `SELECT r.name AS role, u.availability, COUNT(*)::int AS count
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.organization_id = $1
      GROUP BY r.name, u.availability
      ORDER BY r.name`,
    [organizationId]
  );
  return rows;
}

async function listByOrg(organizationId, { role } = {}) {
  const params = [organizationId];
  let where = 'WHERE u.organization_id = $1';
  if (role) {
    params.push(role);
    where += ` AND r.name = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id ${where} ORDER BY u.created_at DESC`,
    params
  );
  return rows;
}

async function findById(userId) {
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { roleBreakdownByOrg, listByOrg, findById };
