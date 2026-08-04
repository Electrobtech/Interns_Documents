// shared/src/models/channelQuotaModel.js
//
// Module 1 — Tenant & Channel Quota Management. Same conventions as
// walletModel.js/companyModel.js: raw `pg` SQL (no ORM in this repo),
// callers run under withSystemAccess() (Super Admin routes) or
// withTenantScope(organizationId) (a tenant reading its own rows).
//
// See infra/db/migrations/026_channel_quotas.sql for the schema and for
// why this is a separate table from `channels`.

const { pool } = require('../db');

const CHANNELS = Object.freeze([
  'whatsapp', 'instagram', 'messenger', 'linkedin',
  'sms_rcs', 'webchat', 'voice', 'email',
]);

class QuotaExceededError extends Error {}
class ChannelDisabledError extends Error {}

function assertChannel(channel) {
  if (!CHANNELS.includes(channel)) {
    throw new Error(`Unknown channel "${channel}". Expected one of: ${CHANNELS.join(', ')}`);
  }
}

function currentPeriodStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

// All 8 channel rows for a tenant, for the Super Admin company-detail
// "Channels & Quotas" panel. Rolls quota_used back to 0 first if the
// stored period has already lapsed, so the admin always sees this
// month's usage rather than a stale number from before the reset.
async function listForOrg(organizationId) {
  await resetLapsedPeriods(organizationId);
  const { rows } = await pool.query(
    `SELECT * FROM channel_quotas WHERE organization_id = $1 ORDER BY channel`,
    [organizationId]
  );
  return rows;
}

async function resetLapsedPeriods(organizationId) {
  await pool.query(
    `UPDATE channel_quotas
        SET quota_used = 0, quota_period_start = $2, updated_at = now()
      WHERE organization_id = $1 AND quota_period_start < $2`,
    [organizationId, currentPeriodStart()]
  );
}

// Super Admin governance action: enable/disable a channel and/or change
// its monthly cap or warning threshold. Partial updates — omit a field
// to leave it unchanged.
async function upsertConfig(organizationId, channel, { enabled, monthlyQuota, lowQuotaThresholdPct, disabledReason, adminId } = {}) {
  assertChannel(channel);
  if (monthlyQuota !== undefined && monthlyQuota !== null && !(Number(monthlyQuota) >= 0)) {
    throw new Error('monthlyQuota must be a non-negative number, or null for unlimited');
  }
  if (lowQuotaThresholdPct !== undefined && !(lowQuotaThresholdPct >= 1 && lowQuotaThresholdPct <= 100)) {
    throw new Error('lowQuotaThresholdPct must be between 1 and 100');
  }

  const { rows } = await pool.query(
    `UPDATE channel_quotas
        SET enabled                 = COALESCE($3, enabled),
            monthly_quota           = CASE WHEN $4::boolean THEN $5::int ELSE monthly_quota END,
            low_quota_threshold_pct = COALESCE($6, low_quota_threshold_pct),
            disabled_reason         = CASE WHEN $3 = false THEN $7 WHEN $3 = true THEN NULL ELSE disabled_reason END,
            updated_by_admin        = $8,
            updated_at              = now()
      WHERE organization_id = $1 AND channel = $2
      RETURNING *`,
    [
      organizationId,
      channel,
      enabled === undefined ? null : enabled,
      monthlyQuota !== undefined, // $4: whether the caller touched monthlyQuota at all (vs omitted)
      monthlyQuota === undefined ? null : monthlyQuota, // $5
      lowQuotaThresholdPct === undefined ? null : lowQuotaThresholdPct,
      disabledReason || null,
      adminId || null,
    ]
  );
  if (!rows.length) throw new Error(`No channel_quotas row for organization ${organizationId} / channel ${channel}`);
  return rows[0];
}

// Manual reset of this month's usage counter (e.g. support goodwill
// gesture after a billing dispute). Does not touch monthly_quota/enabled.
async function resetUsage(organizationId, channel, { adminId } = {}) {
  assertChannel(channel);
  const { rows } = await pool.query(
    `UPDATE channel_quotas
        SET quota_used = 0, quota_period_start = $3, updated_by_admin = $4, updated_at = now()
      WHERE organization_id = $1 AND channel = $2
      RETURNING *`,
    [organizationId, channel, currentPeriodStart(), adminId || null]
  );
  if (!rows.length) throw new Error(`No channel_quotas row for organization ${organizationId} / channel ${channel}`);
  return rows[0];
}

// ---------- Usage engine (called from sender/webhook code paths) ----------
// See the migration's header comment: ready to call, wiring into each
// service's send path is a deliberately separate, per-service change.
//
// Row-locks the same way walletModel.deduct() does, for the same reason:
// two concurrent sends on the same channel must not both read
// quota_used=N, both decide "under cap", and both proceed.
async function recordUsage(organizationId, channel, quantity = 1) {
  assertChannel(channel);
  try {
    await pool.query('BEGIN');

    const period = currentPeriodStart();
    const rowRes = await pool.query(
      `SELECT * FROM channel_quotas WHERE organization_id = $1 AND channel = $2 FOR UPDATE`,
      [organizationId, channel]
    );
    if (!rowRes.rows.length) throw new Error(`No channel_quotas row for organization ${organizationId} / channel ${channel}`);
    let row = rowRes.rows[0];

    // Lapsed period — reset before applying this usage, so it counts
    // against the fresh period rather than inflating the old one.
    if (row.quota_period_start < period) {
      const resetRes = await pool.query(
        `UPDATE channel_quotas SET quota_used = 0, quota_period_start = $3, updated_at = now()
          WHERE organization_id = $1 AND channel = $2 RETURNING *`,
        [organizationId, channel, period]
      );
      row = resetRes.rows[0];
    }

    if (!row.enabled) {
      await pool.query('ROLLBACK');
      throw new ChannelDisabledError(`Channel "${channel}" is disabled for organization ${organizationId}`);
    }

    const newUsed = row.quota_used + quantity;
    if (row.monthly_quota != null && newUsed > row.monthly_quota) {
      await pool.query('ROLLBACK');
      throw new QuotaExceededError(
        `Channel "${channel}" quota exceeded for organization ${organizationId}: ${newUsed}/${row.monthly_quota}`
      );
    }

    const { rows } = await pool.query(
      `UPDATE channel_quotas SET quota_used = $3, updated_at = now()
        WHERE organization_id = $1 AND channel = $2 RETURNING *`,
      [organizationId, channel, newUsed]
    );
    await pool.query('COMMIT');

    const updated = rows[0];
    const lowQuota =
      updated.monthly_quota != null &&
      updated.quota_used >= (updated.monthly_quota * updated.low_quota_threshold_pct) / 100;

    return { channelQuota: updated, lowQuota };
  } catch (e) {
    if (!(e instanceof QuotaExceededError) && !(e instanceof ChannelDisabledError)) {
      await pool.query('ROLLBACK').catch(() => {});
    }
    throw e;
  }
}

// Non-mutating pre-flight check — lets a sender decide whether to even
// attempt the call (and surface a clean error to the tenant) before
// doing the actual API request.
async function checkQuota(organizationId, channel) {
  assertChannel(channel);
  await resetLapsedPeriods(organizationId);
  const { rows } = await pool.query(
    `SELECT * FROM channel_quotas WHERE organization_id = $1 AND channel = $2`,
    [organizationId, channel]
  );
  if (!rows.length) throw new Error(`No channel_quotas row for organization ${organizationId} / channel ${channel}`);
  const row = rows[0];
  const remaining = row.monthly_quota == null ? null : Math.max(0, row.monthly_quota - row.quota_used);
  return {
    enabled: row.enabled,
    allowed: row.enabled && (row.monthly_quota == null || row.quota_used < row.monthly_quota),
    remaining,
    channelQuota: row,
  };
}

// Cross-tenant summary for a future analytics widget (Module 3) —
// total configured/used per channel across every tenant.
async function platformSummary() {
  const { rows } = await pool.query(
    `SELECT channel,
            COUNT(*)::int AS tenant_count,
            COUNT(*) FILTER (WHERE enabled)::int AS enabled_count,
            COALESCE(SUM(quota_used), 0)::int AS total_used
       FROM channel_quotas
      GROUP BY channel
      ORDER BY channel`
  );
  return rows;
}

module.exports = {
  CHANNELS,
  QuotaExceededError,
  ChannelDisabledError,
  listForOrg,
  upsertConfig,
  resetUsage,
  recordUsage,
  checkQuota,
  platformSummary,
};
