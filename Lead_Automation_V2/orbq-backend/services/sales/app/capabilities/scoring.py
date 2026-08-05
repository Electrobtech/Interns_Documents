"""Lead scoring, buying intent, and opportunity scoring — Phase 8.

Design constraint carried over from the old backend: the Sales Agent is a
read-only recommender. It scores and explains; it never mutates a CRM record.
Applying a score to the CRM is a separate, approval-gated action.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from orbq_ai.capability import BaseCapability
from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext


class ScoreFactor(BaseModel):
    factor: str
    impact: Literal["strong_positive", "positive", "neutral", "negative", "strong_negative"]
    evidence: str = Field(description="What in the data supports this")
    weight: float = Field(ge=0.0, le=1.0)


class LeadScoreOutput(BaseModel):
    score: int = Field(ge=0, le=100)
    tier: Literal["hot", "warm", "cold", "disqualified"]
    tier_reason: str
    factors: list[ScoreFactor]
    recommended_action: str
    next_best_channel: Literal["whatsapp", "email", "call", "linkedin", "none"]
    missing_data: list[str] = Field(
        description="What you would need to score this confidently"
    )
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class LeadScoringCapability(BaseCapability):
    name = "lead_scoring"
    workspace = Workspace.SALES
    description = (
        "Score and tier a lead with explainable factors. Use for qualification, "
        "prioritization, 'which leads should I call'."
    )
    output_schema = LeadScoreOutput
    cost_hint = 1800
    temperature = 0.2

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You score sales leads. You are a recommender, not a system of "
            "record — you never modify the CRM.\n\n"
            "Hard rules:\n"
            "1. Every factor needs `evidence` drawn from the supplied data. A "
            "factor with no evidence is a guess; omit it rather than invent "
            "support.\n"
            "2. Score bands: 80-100 hot (engaged, budget signals, clear need), "
            "50-79 warm (fit but unproven intent), 20-49 cold (fit unclear), "
            "0-19 disqualified (explicit no, wrong segment, no budget).\n"
            "3. `missing_data` is mandatory when you are working from thin "
            "information. Say what you would need — it is more useful than a "
            "confident number built on nothing.\n"
            "4. If the lead data is essentially empty, score conservatively, "
            "set confidence below 0.35, and say so in tier_reason. Do not "
            "manufacture a plausible-looking 72.\n\n"
            + self.schema_block()
        )


class IntentSignal(BaseModel):
    signal: str
    strength: Literal["strong", "moderate", "weak"]
    source: str
    observed_when: str | None = None


class BuyingIntentOutput(BaseModel):
    intent_level: Literal["ready_to_buy", "evaluating", "researching", "unaware", "unknown"]
    intent_score: int = Field(ge=0, le=100)
    signals: list[IntentSignal]
    buying_stage: str
    blockers: list[str] = Field(default_factory=list)
    recommended_timing: str
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class BuyingIntentCapability(BaseCapability):
    name = "buying_intent"
    workspace = Workspace.SALES
    description = "Detect purchase intent and buying stage from engagement signals."
    output_schema = BuyingIntentOutput
    cost_hint = 1600
    temperature = 0.25

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You assess buying intent from observable engagement.\n\n"
            "Strong signals: pricing-page visits, demo requests, "
            "procurement/security questions, multiple stakeholders joining, "
            "explicit timeline mentions. Weak signals: a single content "
            "download, a newsletter open, one website visit.\n\n"
            "Hard rules:\n"
            "1. Every signal needs a `source`. Never assert an intent signal "
            "you cannot point at.\n"
            "2. Absence of signal is `unknown`, not `unaware`. Those are "
            "different, and confusing them makes a rep write off a live deal.\n"
            "3. `blockers` matter as much as intent — budget freeze, incumbent "
            "contract, missing champion.\n\n"
            + self.schema_block()
        )


class OpportunityOutput(BaseModel):
    win_probability: int = Field(ge=0, le=100)
    estimated_value: float | None = Field(
        default=None, description="Only if supported by the data; else null"
    )
    expected_close: str | None = None
    risk_factors: list[str]
    accelerators: list[str]
    recommended_next_step: str
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class OpportunityScoreCapability(BaseCapability):
    name = "opportunity_score"
    workspace = Workspace.SALES
    description = "Win probability and deal risk for an active opportunity."
    output_schema = OpportunityOutput
    requires = ["lead_scoring"]
    cost_hint = 1800
    temperature = 0.25

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You assess deal health for an active opportunity.\n\n"
            "Hard rules:\n"
            "1. Never invent `estimated_value`. Set it only if a figure appears "
            "in the supplied data — otherwise null.\n"
            "2. Sales reps are systematically optimistic. Be the counterweight: "
            "a deal with no identified champion, no timeline, and no budget "
            "confirmation is below 30% regardless of how positive the last call "
            "felt.\n"
            "3. `risk_factors` must be specific. 'Competition' is useless; "
            "'incumbent renewal lands in March, before our close date' is "
            "actionable.\n\n"
            + self.schema_block()
        )
