/**
 * Stand-in for a real WhatsApp Business Cloud API call. This is the ONLY
 * function a real integration replaces — see providers/index.js and
 * services/mhWorker.js, which only ever call `sendMessage()` and never
 * reach into how it's implemented. Modeled on campaign-service's own
 * `simulateProviderSend()` (services/campaign-service/src/services/
 * bulkCampaignWorker.js): realistic latency + a small simulated failure
 * rate, so the queue/retry/status plumbing around it has something real
 * (if synthetic) to react to.
 */
async function sendMessage({ destination, name, body }) {
  await sleep(150 + Math.random() * 750);
  if (Math.random() < 0.04) {
    throw new Error(`Simulated WhatsApp rejection for ${destination} (e.g. invalid number / not opted in)`);
  }
  return { providerMessageId: `sim_wa_${Date.now()}_${Math.round(Math.random() * 1e6)}` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendMessage };
