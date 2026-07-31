// shared/src/models/companyModel.js
//
// Data-access layer for organizations ("companies"/tenants), written
// for the Super Admin dashboard. No ORM here on purpose — nothing in
// this repo uses Prisma/TypeORM/Sequelize (grepped every service's
// package.json), every existing controller talks to Postgres with raw
// `pg` queries (see auth-service/src/controllers/companyController.js),
// and introducing an ORM just for this feature would split the codebase
// into two different data-access styles. These functions give you the
// same call-shape an ORM model would (find/list/update), just backed by
// plain SQL so it drops straight into the existing pattern.
//
// Every function here is meant to run under withSystemAccess() (see
// shared/src/db.js) — a super admin needs to see across ALL tenants,
// which is exactly the bypass mechanism this repo already uses for
// registration/login. Do not call these from a tenant-scoped request.

const { pool } = require('../db');

const LIST_COLUMNS = `
  id, name, slug, company_email, company_phone, industry,
  subscription_plan, status, created_at, updated_at
`;

// Paginated, filterable list for the Company Management table.
// filters: { status, subscriptionPlan, search }
async function list({ page = 1, pageSize = 20, status, subscriptionPlan, search } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (subscriptionPlan) {
    params.push(subscriptionPlan);
    conditions.push(`subscription_plan = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR company_email ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(pageSize, 100));
  const offset = (Math.max(1, page) - 1) * limit;

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM organizations ${where}`, params);

  params.push(limit, offset);
  const rows = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM organizations ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows: rows.rows, total: countResult.rows[0].total, page, pageSize: limit };
}

async function findById(organizationId) {
  const { rows } = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [organizationId]);
  return rows[0] || null;
}

// Onboard / suspend / reactivate / change plan — the Super Admin's
// governance actions from section D of the spec. Caller is responsible
// for audit-logging the action (see shared/src/audit.js logAuditRaw).
async function updateStatus(organizationId, status) {
  if (!['pending', 'active', 'suspended'].includes(status)) {
    throw new Error(`Invalid organization status: ${status}`);
  }
  const { rows } = await pool.query(
    `UPDATE organizations SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [organizationId, status]
  );
  return rows[0] || null;
}

async function updateSubscriptionPlan(organizationId, subscriptionPlan) {
  const { rows } = await pool.query(
    `UPDATE organizations SET subscription_plan = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [organizationId, subscriptionPlan]
  );
  return rows[0] || null;
}

module.exports = { list, findById, updateStatus, updateSubscriptionPlan };
