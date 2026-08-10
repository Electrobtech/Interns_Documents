/**
 * Stand-in for a real LinkedIn Campaign Manager / Marketing API call.
 *
 * Campaigns only — LinkedIn broadcasts are rejected before this module is
 * ever reached (DB CHECK constraint `mh_no_linkedin_broadcast` +
 * route-level 400 in routes/campaignsRouter.js). This function simulates
 * the same per-recipient send loop as every other channel for mechanical
 * consistency across the queue/worker, which is a deliberate simplification:
 * real LinkedIn Ads delivery is impression/ad-auction-based, not a
 * per-recipient DM send. The part that must be correct — broadcasts are
 * unsupported — is enforced elsewhere, not here.
 */
async function sendMessage({ destination, name, body }) {
  await sleep(200 + Math.random() * 1200);
  if (Math.random() < 0.03) {
    throw new Error(`Simulated LinkedIn delivery failure for ${destination}`);
  }
  return { providerMessageId: `sim_li_${Date.now()}_${Math.round(Math.random() * 1e6)}` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendMessage };
