const cron = require('node-cron');
const tokenStore = require('./tokenStore');
const store = require('./store');
const googleApi = require('./googleApi');

// Pulls every page of reviews for one location and upserts them.
async function syncLocation(organizationId, accessToken, accountId, locationId) {
  let pageToken;
  let inserted = 0;
  let updated = 0;
  do {
    const page = await googleApi.listReviews(accessToken, accountId, locationId, pageToken);
    const result = await store.upsertReviews(organizationId, locationId, page.reviews);
    inserted += result.inserted;
    updated += result.updated;
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { inserted, updated };
}

// Syncs every known location for an org (or just one, if locationId is given).
// Returns a summary; throws only on token/auth failure (a single location's
// API error is caught and folded into the summary so one bad location
// doesn't abort the rest).
async function syncOrganization(organizationId, { locationId } = {}) {
  const accessToken = await tokenStore.getValidAccessToken(organizationId);

  const locations = locationId
    ? (await store.listLocations(organizationId)).filter((l) => l.locationId === locationId)
    : await store.listLocations(organizationId);

  if (!locations.length) {
    const err = new Error('No Google Business locations found for this organization — fetch locations first');
    err.status = 404;
    throw err;
  }

  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (const loc of locations) {
    try {
      const r = await syncLocation(organizationId, accessToken, loc.accountId, loc.locationId);
      inserted += r.inserted;
      updated += r.updated;
    } catch (e) {
      errors.push({ locationId: loc.locationId, error: e.message });
    }
  }

  await tokenStore.recordSyncResult(organizationId, {
    ok: errors.length === 0,
    error: errors.length ? errors.map((e) => `${e.locationId}: ${e.error}`).join('; ') : null,
  });

  return { locationsSynced: locations.length, inserted, updated, errors };
}

// ---------- Cron ----------

let task = null;

function startCronJob() {
  if (task) return task;
  const minutes = Math.max(1, Number(process.env.GOOGLE_SYNC_INTERVAL_MINUTES) || 15);
  const expr = `*/${minutes} * * * *`;

  task = cron.schedule(expr, async () => {
    let orgIds = [];
    try {
      orgIds = await tokenStore.allConnectedOrganizationIds();
    } catch (e) {
      console.error('[review-service/google] cron: failed to list connected organizations', e.message);
      return;
    }

    for (const organizationId of orgIds) {
      try {
        const summary = await syncOrganization(organizationId);
        console.log(`[review-service/google] cron sync org=${organizationId} locations=${summary.locationsSynced} inserted=${summary.inserted} updated=${summary.updated}${summary.errors.length ? ` errors=${summary.errors.length}` : ''}`);
      } catch (e) {
        console.error(`[review-service/google] cron sync failed org=${organizationId}: ${e.message}`);
      }
    }
  });

  console.log(`[review-service/google] sync cron scheduled every ${minutes} minute(s)`);
  return task;
}

module.exports = { syncOrganization, startCronJob };
