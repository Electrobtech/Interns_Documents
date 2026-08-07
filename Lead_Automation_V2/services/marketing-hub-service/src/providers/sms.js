/** Stand-in for a real SMS gateway (Twilio etc.) call — tuning ported verbatim from campaign-service's simulateProviderSend(), the existing precedent for this exact channel. */
async function sendMessage({ destination, name, body }) {
  await sleep(150 + Math.random() * 750);
  if (Math.random() < 0.04) {
    throw new Error(`Simulated carrier rejection for ${destination} (e.g. invalid number / temporarily unreachable)`);
  }
  return { providerMessageId: `sim_sms_${Date.now()}_${Math.round(Math.random() * 1e6)}` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendMessage };
