/**
 * Stand-in for a real Instagram Graph API DM call. Instagram broadcasts are
 * "limited/simulated" per the product requirement (Instagram does not allow
 * true bulk DM broadcast) — reflected here as a higher failure rate and a
 * lower ceiling on how many recipients a broadcast enqueues, enforced by
 * audienceResolver.js, not by this function. This function itself only
 * simulates one send; see providers/whatsapp.js's header comment for the
 * swap-point contract.
 */
async function sendMessage({ destination, name, body }) {
  await sleep(250 + Math.random() * 1000);
  if (Math.random() < 0.10) {
    throw new Error(`Simulated Instagram DM failure for ${destination} (e.g. rate-limited / outside messaging window)`);
  }
  return { providerMessageId: `sim_ig_${Date.now()}_${Math.round(Math.random() * 1e6)}` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendMessage };
