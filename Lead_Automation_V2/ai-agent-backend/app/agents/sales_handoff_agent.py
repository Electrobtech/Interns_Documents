"""Sales Handoff Agent — narrates real, pre-computed campaign -> lead ->
order data into a handoff brief for the sales team. This agent does NOT
compute numbers, fetch data, or score leads itself — SalesHandoffRepository
runs the real SQL join first, and this module's only job is to summarize
that already-real structured data in plain language. Deliberately does not
duplicate the Sales Agent's lead_score/opportunity_stage job."""
from __future__ import annotations

_REQUIRED_KEYS = ("summary", "headline_stat", "recommended_next_step")

SYSTEM_PROMPT = """You are the sales-handoff module of the Marketing Agent inside an enterprise
Lead Automation CRM platform. You are given REAL, ALREADY-COMPUTED campaign performance data
below (audience size, how many became leads, how many converted to a paid order, and real
revenue figures) — not something you calculate or estimate yourself.

BEHAVIOR RULES:
- Use ONLY the numbers given to you below. Never invent a number, percentage, or amount that
  isn't literally present in the CAMPAIGN CONVERSION DATA block.
- Do NOT assign a lead score, opportunity stage, or forecast — that is the Sales Agent's job,
  not yours. Your job is to summarize what already happened and suggest what a sales rep should
  do next with this real information.
- summary: 2-4 sentences a sales lead could read in five seconds — which campaign(s) are
  actually converting, in plain business language.
- headline_stat: the single most useful real number from the data (e.g. "3 of 12 leads from
  'Spring Promo' became paid orders — ₹42,000") — must be traceable to the given data, not a
  paraphrase that changes the number.
- recommended_next_step: one concrete action a sales rep or manager should take (e.g. "prioritize
  outreach to the remaining 9 leads from this campaign while intent is fresh").
- If the data shows no conversions yet, say so plainly rather than inventing optimism.

Respond with ONLY a single JSON object with EXACTLY these keys (no extra keys, no markdown fences):
{
  "summary": "...",
  "headline_stat": "...",
  "recommended_next_step": "..."
}"""


def build_user_prompt(campaign_data: list[dict], note: str | None) -> str:
    lines = []
    for row in campaign_data:
        lines.append(
            f"- Campaign '{row['name']}' ({row['channel_type']}, status={row['status']}): "
            f"{row['audience_count']} people reached, {row['lead_count']} became leads, "
            f"{row['converted_count']} converted to a paid order, "
            f"₹{row['converted_revenue']} real revenue from those orders."
        )
    data_block = "\n".join(lines) if lines else "(no campaign data available for this organization yet)"
    note_block = f"\nADDITIONAL CONTEXT FROM THE REQUESTER:\n{note}" if note else ""
    return f"CAMPAIGN CONVERSION DATA (real, from the CRM):\n{data_block}{note_block}"


def validate_shape(data: dict) -> dict:
    defaults = {"summary": "", "headline_stat": "", "recommended_next_step": ""}
    for key in _REQUIRED_KEYS:
        if key not in data:
            data[key] = defaults[key]
    return data
