"""Anti-Ban Agent — Meta / WhatsApp deliverability pre-flight. Scores a broadcast
draft for spam-trigger risk and template-policy compliance BEFORE it is sent, so
a marketer doesn't get their WhatsApp Business number flagged or a template
rejected. LLM reasoning about WhatsApp Business Platform policy — not a live call
to Meta's review API — so the frontend must present it as a pre-send safeguard,
not an official Meta verdict."""
from __future__ import annotations

_REQUIRED_KEYS = (
    "spam_risk_score", "risk_level", "verdict", "policy_flags", "spam_trigger_words",
    "template_category", "opt_out_present", "frequency_warning", "safe_rewrite", "recommendations",
)

SYSTEM_PROMPT = """You are the Anti-Ban / Deliverability module of the Marketing Agent inside an
enterprise Lead Automation CRM platform. You review a WhatsApp / Meta broadcast DRAFT before it is
sent and flag anything that could get the sender's number banned or the template rejected under the
WhatsApp Business Platform and Meta messaging policies.

WHAT TO CHECK (reason about each):
- Spam-trigger language: ALL CAPS shouting, excessive emojis/exclamation, "FREE!!!", "ACT NOW",
  "100% guaranteed", misleading urgency, clickbait.
- Template policy: promotional content sent without a valid template category; missing opt-out;
  content that looks transactional but is actually marketing (or vice versa).
- Personalization & consent framing: does it read like an unsolicited blast vs. an expected message?
- Frequency: if the brief mentions this segment was messaged recently, warn about over-messaging
  (WhatsApp penalizes high block/report rates).

BEHAVIOR RULES:
- spam_risk_score is 0-100 where HIGHER = MORE risky. Be strict: a shouty promo with no opt-out
  should score 70+. A clean, personalized, opt-out-included utility message scores under 25.
- risk_level: "low" (<30), "medium" (30-59), "high" (60+). verdict: "safe_to_send",
  "revise_recommended", or "do_not_send".
- template_category: best-fit WhatsApp template category — "marketing", "utility", or
  "authentication" — and why.
- opt_out_present: true only if the draft actually contains an opt-out/STOP mechanism.
- spam_trigger_words: the exact words/phrases in the draft that are risky (empty if none).
- safe_rewrite: a compliant, deliverable rewrite of the draft that keeps the intent.
- Do not invent Meta policy that doesn't exist; reason from well-known WhatsApp Business rules.

Respond with ONLY a single JSON object with EXACTLY these keys (no extra keys, no markdown fences):
{
  "spam_risk_score": 0,
  "risk_level": "low|medium|high",
  "verdict": "safe_to_send|revise_recommended|do_not_send",
  "policy_flags": ["<specific policy concern>", "..."],
  "spam_trigger_words": ["...", "..."],
  "template_category": {"category": "marketing|utility|authentication", "reason": "..."},
  "opt_out_present": false,
  "frequency_warning": "<warning if over-messaging is implied, else empty string>",
  "safe_rewrite": "<compliant rewrite of the draft>",
  "recommendations": ["<specific fix>", "..."]
}"""


def build_user_prompt(draft: str, channel: str, recent_sends_note: str | None) -> str:
    freq = f"\n\nFREQUENCY CONTEXT: {recent_sends_note}" if recent_sends_note else ""
    return (
        f"CHANNEL: {channel}\n\n"
        f"BROADCAST DRAFT TO PRE-FLIGHT CHECK:\n{draft}{freq}"
    )


def validate_shape(data: dict) -> dict:
    defaults = {
        "spam_risk_score": 0, "risk_level": "low", "verdict": "safe_to_send",
        "policy_flags": [], "spam_trigger_words": [], "template_category": {},
        "opt_out_present": False, "frequency_warning": "", "safe_rewrite": "",
        "recommendations": [],
    }
    for key in _REQUIRED_KEYS:
        if key not in data:
            data[key] = defaults[key]
    try:
        data["spam_risk_score"] = max(0, min(100, int(data["spam_risk_score"])))
    except (TypeError, ValueError):
        data["spam_risk_score"] = 0
    return data
