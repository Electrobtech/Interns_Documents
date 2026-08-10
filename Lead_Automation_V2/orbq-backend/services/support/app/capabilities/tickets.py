"""Support capabilities — Phase 9.

The Support Agent has the tightest grounding requirement of the three. A
marketing hallucination is embarrassing; a support hallucination is a wrong
answer sent directly to a paying customer, often about billing or a policy.
Every reply capability here refuses to answer ungrounded and escalates instead.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from orbq_ai.capability import BaseCapability
from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext

Priority = Literal["low", "medium", "high", "urgent"]


class TicketClassificationOutput(BaseModel):
    category: str
    subcategory: str | None = None
    priority: Priority
    priority_reason: str
    sentiment: Literal["positive", "neutral", "frustrated", "angry"]
    is_billing_related: bool
    requires_human: bool
    suggested_team: str
    tags: list[str] = Field(default_factory=list)
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class TicketClassificationCapability(BaseCapability):
    name = "ticket_classification"
    workspace = Workspace.SUPPORT
    description = "Categorize, prioritize, and route an incoming support ticket."
    output_schema = TicketClassificationOutput
    cost_hint = 1000
    temperature = 0.15
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You triage support tickets.\n\n"
            "Priority: `urgent` = service down, data loss, security concern, or "
            "an explicit churn/legal threat. `high` = blocked workflow, billing "
            "dispute, repeat contact on the same issue. `medium` = degraded but "
            "workable. `low` = question or feature request.\n\n"
            "Set `requires_human` true for anything involving billing disputes, "
            "refunds, cancellations, legal or privacy requests, security, or a "
            "visibly angry customer. Those cost far more to get wrong "
            "automatically than to route to a person.\n\n"
            + self.schema_block()
        )


class SuggestedReplyOutput(BaseModel):
    reply: str
    tone: Literal["empathetic", "neutral", "apologetic", "informative"]
    grounded: bool = Field(
        description="True only if every factual claim came from the knowledge base"
    )
    citations_used: list[str] = Field(default_factory=list)
    unresolved_points: list[str] = Field(
        default_factory=list,
        description="Parts of the question the knowledge base could not answer",
    )
    should_escalate: bool
    escalation_reason: str | None = None
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class SuggestedReplyCapability(BaseCapability):
    name = "suggested_reply"
    workspace = Workspace.SUPPORT
    description = "Draft a reply to a customer, grounded strictly in the knowledge base."
    output_schema = SuggestedReplyOutput
    # A reply goes to a real customer. It is drafted for review, never sent.
    action_type = "support.reply"
    requires = ["ticket_classification"]
    cost_hint = 1800
    temperature = 0.3

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You draft support replies. A human reviews before anything sends.\n\n"
            "THE RULE THAT OVERRIDES EVERYTHING ELSE: never state a fact about "
            "this product, policy, price, or process that is not in the "
            "knowledge base. Not from general knowledge, not from what is "
            "typical for similar products, not from what seems reasonable.\n\n"
            "If the knowledge base does not cover the question:\n"
            "  - set `grounded` false\n"
            "  - set `should_escalate` true\n"
            "  - write a reply that acknowledges the customer and says a "
            "specialist will follow up — do NOT guess at an answer\n"
            "  - list what was missing in `unresolved_points`\n\n"
            "A wrong support answer about billing or a refund costs a customer. "
            "'Let me get you a precise answer' costs a few hours. Choose the "
            "few hours, every time.\n\n"
            "Escalate regardless of grounding when the ticket involves refunds, "
            "cancellations, legal or privacy requests, security, or an angry "
            "customer.\n\n"
            + self.schema_block()
        )

    def assess_confidence(self, parsed: SuggestedReplyOutput, ctx: CapabilityContext) -> float:
        """An ungrounded reply is capped low no matter how fluent it reads.

        Fluency and correctness are uncorrelated in exactly the situation that
        matters here, so the model's own confidence cannot be trusted alone.
        """
        base = super().assess_confidence(parsed, ctx)
        if not parsed.grounded:
            base = min(base, 0.3)
        if parsed.unresolved_points:
            base *= 0.8
        return round(min(max(base, 0.0), 1.0), 4)

    def proposed_action(self, parsed: SuggestedReplyOutput, ctx: CapabilityContext) -> dict | None:
        if parsed.should_escalate:
            return None  # escalation isn't a send
        return {
            "action_type": self.action_type,
            "summary": f"Send reply to customer ({parsed.tone})",
            "executor": "automation-service",
            "payload": {"reply": parsed.reply, "conversation_id": str(ctx.context.conversation_id or "")},
            "reversible": False,
            "requires_role": "agent",
        }


class CSATRiskOutput(BaseModel):
    risk_level: Literal["low", "medium", "high", "critical"]
    risk_score: int = Field(ge=0, le=100)
    signals: list[str]
    churn_indicators: list[str] = Field(default_factory=list)
    recommended_intervention: str
    needs_manager: bool
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class CSATRiskCapability(BaseCapability):
    name = "csat_risk"
    workspace = Workspace.SUPPORT
    description = "Detect satisfaction risk and churn signals in a conversation."
    output_schema = CSATRiskOutput
    cost_hint = 1200
    temperature = 0.2
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You detect customer satisfaction risk.\n\n"
            "Critical signals: explicit cancellation or refund threats, "
            "mentions of a competitor, legal or regulator references, public "
            "escalation threats ('I'll post about this'), or a third contact "
            "about the same unresolved issue.\n\n"
            "Be sensitive rather than conservative here. A false positive costs "
            "a manager five minutes; a missed churn signal costs the account.\n\n"
            + self.schema_block()
        )


class EscalationOutput(BaseModel):
    should_escalate: bool
    urgency: Priority
    escalate_to: str
    reason: str
    context_summary: str
    customer_impact: str
    sla_at_risk: bool
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class EscalationCapability(BaseCapability):
    name = "escalation"
    workspace = Workspace.SUPPORT
    description = "Decide whether a ticket needs human escalation, and to whom."
    output_schema = EscalationOutput
    action_type = "support.escalate"
    cost_hint = 1200
    temperature = 0.2
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You decide escalation. When genuinely uncertain, escalate — the "
            "cost asymmetry is not close.\n\n"
            "Always escalate: security or privacy issues, legal threats, "
            "refunds and billing disputes, data loss, anything affecting "
            "multiple customers, and repeat contacts on an unresolved issue.\n\n"
            "`context_summary` must let the receiving human act without reading "
            "the whole thread.\n\n"
            + self.schema_block()
        )

    def proposed_action(self, parsed: EscalationOutput, ctx: CapabilityContext) -> dict | None:
        if not parsed.should_escalate:
            return None
        return {
            "action_type": self.action_type,
            "summary": f"Escalate to {parsed.escalate_to} ({parsed.urgency})",
            "executor": "internal",
            "payload": parsed.model_dump(mode="json"),
            "reversible": True,
            "requires_role": "agent",
        }


class SLAOutput(BaseModel):
    status: Literal["within_sla", "at_risk", "breached"]
    time_remaining: str | None = None
    breach_reason: str | None = None
    recommended_action: str
    tickets_at_risk: list[str] = Field(default_factory=list)
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class SLAMonitorCapability(BaseCapability):
    name = "sla_monitor"
    workspace = Workspace.SUPPORT
    description = "Assess SLA status and flag tickets at risk of breach."
    output_schema = SLAOutput
    cost_hint = 900
    temperature = 0.1
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You assess SLA status from the supplied ticket timing data.\n\n"
            "Only report on tickets present in the input. Never infer an SLA "
            "target that was not provided — if the policy is unknown, say so "
            "rather than assuming an industry-standard 24h.\n\n"
            + self.schema_block()
        )


class ConversationSummaryOutput(BaseModel):
    summary: str
    issue: str
    steps_taken: list[str]
    current_status: str
    customer_sentiment_arc: str
    open_items: list[str]
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class ConversationSummaryCapability(BaseCapability):
    name = "conversation_summary"
    workspace = Workspace.SUPPORT
    description = "Summarize a support conversation for handoff or review."
    output_schema = ConversationSummaryOutput
    cost_hint = 1200
    temperature = 0.2
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You summarize support conversations for a colleague picking the "
            "ticket up.\n\n"
            "Summarize only what is in the transcript. Never add a resolution "
            "step that was not actually taken — a summary claiming something "
            "was tried sends the next agent down a false path.\n\n"
            "`open_items` is the point of the summary: what still needs doing.\n\n"
            + self.schema_block()
        )


class TimelineEvent(BaseModel):
    when: str
    what: str
    channel: str | None = None
    significance: Literal["high", "medium", "low"] = "medium"


class CustomerTimelineOutput(BaseModel):
    events: list[TimelineEvent]
    relationship_summary: str
    recurring_issues: list[str] = Field(default_factory=list)
    total_interactions: int | None = None
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class CustomerTimelineCapability(BaseCapability):
    name = "customer_timeline"
    workspace = Workspace.SUPPORT
    description = "Chronological history of a customer's interactions."
    output_schema = CustomerTimelineOutput
    cost_hint = 1400
    temperature = 0.2
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You build a customer interaction timeline from supplied records.\n\n"
            "Include only events present in the data. `recurring_issues` is the "
            "highest-value output — the same problem appearing three times "
            "means the fix never worked, and that changes how this ticket "
            "should be handled.\n\n"
            "Set `total_interactions` only if the data supports a count.\n\n"
            + self.schema_block()
        )
