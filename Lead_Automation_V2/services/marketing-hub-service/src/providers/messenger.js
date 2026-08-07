/** Stand-in for a real Facebook Messenger Send API call. See providers/whatsapp.js's header comment — same contract. */
async function sendMessage({ destination, name, body }) {
  await sleep(150 + Math.random() * 750);
  if (Math.random() < 0.04) {
    throw new Error(`Simulated Messenger send failure for ${destination} (e.g. 24h messaging window expired)`);
  }
  return { providerMessageId: `sim_fb_${Date.now()}_${Math.round(Math.random() * 1e6)}` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendMessage };
