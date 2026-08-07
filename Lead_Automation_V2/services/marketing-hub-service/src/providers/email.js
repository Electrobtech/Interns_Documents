/** Stand-in for a real SMTP/SES/SendGrid call. See providers/whatsapp.js's header comment — same contract, same swap-point discipline. */
async function sendMessage({ destination, name, body }) {
  await sleep(200 + Math.random() * 1200);
  if (Math.random() < 0.03) {
    throw new Error(`Simulated email bounce for ${destination} (e.g. mailbox full / domain rejected)`);
  }
  return { providerMessageId: `sim_em_${Date.now()}_${Math.round(Math.random() * 1e6)}` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendMessage };
