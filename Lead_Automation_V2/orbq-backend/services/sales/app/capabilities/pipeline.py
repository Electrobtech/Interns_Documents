"""Pipeline, forecasting, CRM analysis, meeting prep, handoff — Phase 8."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from orbq_ai.capability import BaseCapability
from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext


class StageHealth(BaseModel):
    stage: str
    count: int
    concerns: list[str] = Field(default_factory=list)


class PipelineOutput(BaseModel):
    stages: list[StageHealth]
    bottleneck_stage: str | None = None
    stalled_deals: list[str] = Field(default_factory=list)
    coverage_assessment: str
    recommended_actions: list[str]
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class PipelineAnalysisCapability(BaseCapability):
    name = "pipeline_analysis"
    workspace = Workspace.SALES
    description = "Pipeline health, bottlenecks, and stalled deals."
    output_schema = PipelineOutput
    cost_hint = 2000
    temperature = 0.25
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You analyze sales pipeline health from the supplied stage data.\n\n"
            "Hard rules:\n"
            "1. Only report counts present in the data. Never estimate a stage "
            "count to make the funnel look complete.\n"
            "2. The bottleneck is where conversion drops hardest between "
            "adjacent stages, not simply the stage with the most deals.\n"
            "3. If the supplied data has no stage counts at all, say so and set "
            "confidence below 0.3 rather than describing a generic funnel.\n\n"
            + self.schema_block()
        )


class ForecastPeriod(BaseModel):
    period: str
    committed: float | None = None
    best_case: float | None = None
    worst_case: float | None = None
    basis: str = Field(description="What these numbers are derived from")


class ForecastOutput(BaseModel):
    periods: list[ForecastPeriod]
    methodology: str
    assumptions: list[str]
    data_quality_warning: str | None = Field(
        default=None,
        description="Set when the data is too thin for a reliable forecast",
    )
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class RevenueForecastCapability(BaseCapability):
    name = "revenue_forecast"
    workspace = Workspace.SALES
    description = "Revenue forecast from pipeline data with explicit assumptions."
    output_schema = ForecastOutput
    requires = ["pipeline_analysis"]
    cost_hint = 2200
    temperature = 0.2
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You forecast revenue from pipeline data.\n\n"
            "A forecast is a claim someone will plan headcount against, so "
            "false precision here is genuinely harmful.\n\n"
            "Hard rules:\n"
            "1. Every number needs a `basis`. If you cannot state where it came "
            "from, set it null rather than producing a figure.\n"
            "2. State every assumption in `assumptions` — win rate applied, "
            "cycle length assumed, deals excluded.\n"
            "3. If there is insufficient historical data to infer a win rate, "
            "set `data_quality_warning`, leave the amounts null, and set "
            "confidence below 0.3. An honest 'I cannot forecast this yet' is "
            "worth more than an invented number that gets put in a board deck.\n\n"
            + self.schema_block()
        )


class CRMAnalysisOutput(BaseModel):
    data_quality_score: int = Field(ge=0, le=100)
    issues: list[dict[str, str]] = Field(description="[{'issue':..., 'impact':..., 'fix':...}]")
    duplicate_risk: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    recommendations: list[str]
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class CRMAnalysisCapability(BaseCapability):
    name = "crm_analysis"
    workspace = Workspace.SALES
    description = "CRM data quality: gaps, duplicates, and hygiene issues."
    output_schema = CRMAnalysisOutput
    cost_hint = 1600
    temperature = 0.2
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You audit CRM data quality. Bad CRM data quietly corrupts every "
            "downstream score and forecast, so be specific about what is broken "
            "and what it costs.\n\n"
            "Each issue needs a concrete `impact` — 'missing email blocks "
            "nurture sequences for 40% of leads' beats 'incomplete data'.\n\n"
            + self.schema_block()
        )


class MeetingPrepOutput(BaseModel):
    account_summary: str
    attendee_notes: list[str] = Field(default_factory=list)
    talking_points: list[str]
    discovery_questions: list[str]
    likely_objections: list[dict[str, str]] = Field(
        description="[{'objection':..., 'response':...}]"
    )
    desired_outcome: str
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class MeetingPrepCapability(BaseCapability):
    name = "meeting_prep"
    workspace = Workspace.SALES
    description = "Pre-call brief: context, talking points, objections, discovery questions."
    output_schema = MeetingPrepOutput
    cost_hint = 2000
    temperature = 0.4

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You prepare a rep for a specific meeting.\n\n"
            "Hard rules:\n"
            "1. Never invent history. If you do not know what was discussed "
            "previously, say the history is unavailable rather than "
            "constructing a plausible account — a rep who references a "
            "conversation that never happened destroys trust instantly.\n"
            "2. Discovery questions should be open and specific to this "
            "account, not a generic MEDDIC checklist.\n"
            "3. Objection responses must be honest. Never suggest the rep make "
            "a claim the knowledge base does not support.\n\n"
            + self.schema_block()
        )


class HandoffOutput(BaseModel):
    summary: str
    qualification_status: Literal["qualified", "needs_work", "not_qualified"]
    context_for_receiver: list[str]
    open_questions: list[str]
    recommended_owner_profile: str
    urgency: Literal["immediate", "this_week", "routine"]
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class SalesHandoffCapability(BaseCapability):
    name = "sales_handoff"
    workspace = Workspace.SALES
    description = "Package a lead for handoff to a human rep or another team."
    output_schema = HandoffOutput
    # Reassigning ownership is customer-affecting and hard to reverse cleanly,
    # so it is gated rather than executed (§12.3).
    action_type = "lead.handoff"
    requires = ["lead_scoring"]
    cost_hint = 1500
    temperature = 0.3

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You package a lead for handoff to a human.\n\n"
            "The receiving rep should need zero additional research. Include "
            "what was promised, what is still unknown, and why this is urgent "
            "or not.\n\n"
            "`open_questions` is the most valuable field — it prevents the rep "
            "re-asking something the lead already answered, which is the "
            "fastest way to make a prospect feel like a ticket.\n\n"
            + self.schema_block()
        )

    def proposed_action(self, parsed: HandoffOutput, ctx: CapabilityContext) -> dict:
        return {
            "action_type": self.action_type,
            "summary": f"Hand off lead ({parsed.qualification_status}, {parsed.urgency})",
            "executor": "contact-service",
            "payload": parsed.model_dump(mode="json"),
            "reversible": True,
            "requires_role": "manager",
        }


class FollowUpStep(BaseModel):
    day_offset: int
    channel: Literal["whatsapp", "email", "sms", "call"]
    message: str
    goal: str


class ColdRevivalOutput(BaseModel):
    sequence: list[FollowUpStep]
    segment_criteria: str
    exit_conditions: list[str]
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class ColdLeadRevivalCapability(BaseCapability):
    name = "cold_lead_revival"
    workspace = Workspace.SALES
    description = "Re-engagement sequences for dormant leads."
    output_schema = ColdRevivalOutput
    action_type = "campaign.publish"
    cost_hint = 2000
    temperature = 0.5

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You design re-engagement sequences for leads who went quiet.\n\n"
            "Lead with something useful rather than 'just checking in'. "
            "Acknowledge the silence without guilt-tripping. Give an easy exit "
            "in every message. Stop after 3-4 touches — past that you damage "
            "both the brand and the sending reputation.\n\n"
            "`exit_conditions` is mandatory and must include an explicit "
            "opt-out. A sequence with no stop condition is a spam engine.\n\n"
            + self.schema_block()
        )

    def proposed_action(self, parsed: ColdRevivalOutput, ctx: CapabilityContext) -> dict:
        return {
            "action_type": self.action_type,
            "summary": f"Launch revival sequence ({len(parsed.sequence)} touches)",
            "executor": "campaign-service",
            "payload": parsed.model_dump(mode="json"),
            "reversible": False,
            "requires_role": "manager",
        }
