const { sign } = require('@lead/shared');

// Container-to-container call to ai-agent-service, bypassing the gateway —
// an inbound chat webhook has no end-user CRM session/JWT to forward (unlike
// campaign-service -> automation-service, which forwards the caller's own
// bearer token; see campaignSendController.js), so this signs a short-lived
// service-identity token with the same JWT_SECRET instead. ai-agent-service's
// get_current_user only requires a validly-signed {userId, organizationId,
// role, permissions} payload — it doesn't care which service minted it.
const AI_AGENT_SERVICE_URL = process.env.AI_AGENT_SERVICE_URL || 'http://ai-agent-service:4005';

/**
 * Calls the Support Agent's grounded-reply endpoint for an `ai_response`
 * node. Returns the reply text, or a safe fallback string if the call fails
 * — a flow must never crash mid-conversation because the AI service is
 * briefly unavailable.
 */
async function getAiResponse({ organizationId, brief, customerName, sessionId }) {
  // Minted fresh for this one call, never stored or reused.
  const token = sign({ userId: 'system:automation-service', organizationId, role: 'system', permissions: [] });

  try {
    const res = await fetch(`${AI_AGENT_SERVICE_URL}/ai-agents/support/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        brief: brief || 'The customer has not said anything specific yet — greet them and ask how you can help.',
        customer_name: customerName || null,
        session_id: sessionId || null,
      }),
    });
    if (!res.ok) throw new Error(`ai-agent-service responded ${res.status}`);
    const data = await res.json();
    return {
      text: data.suggested_reply || "Thanks for reaching out — let me get a human to help with that.",
      escalate: !!data.escalation_needed || !!data.human_handoff,
    };
  } catch (err) {
    console.error('[aiResponder] ai-agent-service call failed (non-fatal):', err.message);
    return { text: "I'm having trouble finding that right now — connecting you with a team member.", escalate: true };
  }
}

module.exports = { getAiResponse };
