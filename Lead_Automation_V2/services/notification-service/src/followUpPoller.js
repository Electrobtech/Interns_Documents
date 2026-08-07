/**
 * src/followUpPoller.js
 *
 * Task 3/5 (Support Agent — Notifications): turns a follow-up's due date
 * coming due into a real notification row, instead of the bell dropdown
 * only ever showing hardcoded/example data.
 *
 * Trigger threshold (documented per the task's "decide and document your
 * threshold" instruction): a pending follow-up becomes a notification once
 * it falls into contact-service's own 'today' or 'overdue' buckets (see
 * services/contact-service/src/followUpRoutes.js) — i.e. due sometime
 * today, or already past due. Not 'upcoming' (future) follow-ups. This
 * reuses the bucket semantics the Follow-ups page already exposes rather
 * than inventing a second definition of "due soon" — e.g. a follow-up due
 * at 11pm gets notified as soon as its calendar day starts, not only in
 * its final 24h window.
 *
 * Dedup: the `ux_notifications_org_followup` partial unique index (see
 * infra/db/migrations/031_notification_followups.sql) makes the INSERT a
 * no-op for a follow-up that's already been notified, so this can safely
 * run on every poll cycle without re-alerting on the same follow-up every
 * 60 seconds.
 */
const CONTACT_SERVICE_URL = process.env.CONTACT_SERVICE_URL || 'http://contact-service:4003';
const FETCH_TIMEOUT_MS = 8_000;

async function fetchJson(url, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Due follow-ups (today + overdue) for one organization, via contact-service. */
async function fetchDueFollowUps(organizationId, sign) {
  // Minted fresh per poll cycle, never stored — same short-lived
  // service-identity token pattern used by automation-service's
  // aiResponder.js for its container-to-container call to ai-agent-service.
  const token = sign({
    userId: 'system:notification-service',
    organizationId,
    role: 'system',
    permissions: [],
  });

  const [today, overdue] = await Promise.all([
    fetchJson(`${CONTACT_SERVICE_URL}/follow-ups?bucket=today`, token).catch((err) => {
      console.error(`[notification-service] fetch bucket=today failed (org=${organizationId}):`, err.message);
      return [];
    }),
    fetchJson(`${CONTACT_SERVICE_URL}/follow-ups?bucket=overdue`, token).catch((err) => {
      console.error(`[notification-service] fetch bucket=overdue failed (org=${organizationId}):`, err.message);
      return [];
    }),
  ]);

  const all = [...(Array.isArray(today) ? today : []), ...(Array.isArray(overdue) ? overdue : [])];
  // A follow-up can't be in both buckets, but de-dupe by id defensively.
  const seen = new Set();
  return all.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

async function pollOrganization(organizationId, { pool, sign, withTenantScope }) {
  const due = await fetchDueFollowUps(organizationId, sign);
  if (!due.length) return;

  await withTenantScope(organizationId, async () => {
    for (const f of due) {
      const overdue = f.status === 'pending' && new Date(f.due_at) < new Date();
      const title = overdue ? 'Follow-up overdue' : 'Follow-up due today';
      const body = `${f.contact_name || 'A contact'} — due ${new Date(f.due_at).toLocaleString()}`;

      try {
        // ON CONFLICT DO NOTHING against ux_notifications_org_followup:
        // a follow-up already notified once is a silent no-op here, not
        // a fresh row, so the badge count doesn't grow on every poll.
        await pool.query(
          `INSERT INTO notifications (organization_id, type, title, body, contact_id, follow_up_id, read)
           VALUES ($1, 'followup_due', $2, $3, $4, $5, false)
           ON CONFLICT (organization_id, follow_up_id) WHERE follow_up_id IS NOT NULL
           DO NOTHING`,
          [organizationId, title, body, f.contact_id, f.id]
        );
      } catch (err) {
        console.error(`[notification-service] insert notification failed (org=${organizationId}, follow_up=${f.id}):`, err.message);
      }
    }
  });
}

/** Runs one poll cycle across every organization. */
async function pollAllOrganizations({ pool, sign, withTenantScope, withSystemAccess }) {
  let orgs;
  try {
    orgs = await withSystemAccess(() => pool.query('SELECT id FROM organizations'));
  } catch (err) {
    console.error('[notification-service] failed to list organizations for polling:', err.message);
    return;
  }

  for (const { id } of orgs.rows) {
    try {
      await pollOrganization(id, { pool, sign, withTenantScope });
    } catch (err) {
      console.error(`[notification-service] poll failed for org ${id}:`, err.message);
    }
  }
}

module.exports = { pollAllOrganizations, pollOrganization, fetchDueFollowUps };
