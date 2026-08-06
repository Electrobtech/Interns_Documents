"""Campaign planning.

Phase 21 boundary (§24.3): Orbq **plans**, the Node campaign-service **executes**.
This capability emits a plan and proposes it for approval; it never sends
anything. Your existing BullMQ engine (bulkCampaignQueue / bulkCampaignWorker)
remains the only thing that touches a customer.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext

from orbq_ai.capability import BaseCapability

Channel = Literal["whatsapp", "email", "sms", "instagram", "linkedin", "meta_ads", "google_ads"]


class CampaignItem(BaseModel):
    sequence: int
    channel: Channel
    day_offset: int = Field(description="Days after campaign start")
    subject: str | None = Field(default=None, description="Email subject; null for other channels")
    message_body: str
    call_to_action: str
    audience_filter: str = Field(description="Which segment receives this, in plain language")


class CampaignPlan(BaseModel):
    name: str
    goal: str
    timeframe: str
    channels: list[Channel]
    audience_summary: str
    estimated_reach: int | None = Field(
        default=None,
        description="Only if the knowledge base or upstream data supports it; else null",
    )
    items: list[CampaignItem]
    success_metrics: list[str]
    risks: list[str] = Field(default_factory=list)


class CampaignPlannerOutput(BaseModel):
    plan: CampaignPlan
    alternatives: list[str] = Field(
        default_factory=list, description="Approaches considered and rejected, with why"
    )
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class CampaignPlannerCapability(BaseCapability):
    name = "campaign_planner"
    workspace = Workspace.MARKETING
    description = (
        "Multi-channel campaign plans with message sequences, timing, and "
        "audience segments. Use for campaign strategy, outreach planning, calendars."
    )
    output_schema = CampaignPlannerOutput
    # Publishing a campaign is customer-visible and irreversible at scale, so it
    # is approval-gated. The capability produces a proposal, never a send.
    action_type = "campaign.publish"
    requires = ["persona"]
    cost_hint = 3000
    temperature = 0.5
    max_tokens = 4096

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You are a campaign strategist. You produce PLANS. You never send "
            "anything — a human approves, and a separate delivery system "
            "executes.\n\n"
            "Hard rules:\n"
            "1. Copy must be channel-appropriate. WhatsApp is short and "
            "conversational; email carries a subject line; SMS is under 160 "
            "characters. Do not write one message and paste it everywhere.\n"
            "2. Never invent `estimated_reach`. Set it only if audience size "
            "appears in the knowledge base or upstream results — otherwise null.\n"
            "3. Respect messaging policy: no misleading claims, no fake urgency, "
            "no unverifiable statistics. WhatsApp Business policy in particular "
            "prohibits promotional content outside an active session window.\n"
            "4. `risks` must be honest — deliverability, fatigue, timing "
            "conflicts, compliance exposure.\n"
            "5. If an upstream persona is available, target it explicitly. If "
            "not, say so in reasoning and lower confidence.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        blocks = [
            f"<request>\n{ctx.message}\n</request>",
            self.upstream_block(ctx),
            self.knowledge_block(ctx),
            self.memory_block(ctx),
        ]
        return "\n\n".join(b for b in blocks if b)

    def proposed_action(self, parsed: CampaignPlannerOutput, ctx: CapabilityContext) -> dict:
        """Hand the plan to the approval engine.

        On approval, `orbq.campaign.plan_approved.v1` is published and the Node
        campaign-service materializes and sends it. Orbq's involvement ends at
        the plan.
        """
        return {
            "action_type": self.action_type,
            "summary": f"Publish campaign '{parsed.plan.name}' across {', '.join(parsed.plan.channels)}",
            "executor": "campaign-service",
            "payload": parsed.plan.model_dump(mode="json"),
            "reversible": False,
            "requires_role": "manager",
        }
