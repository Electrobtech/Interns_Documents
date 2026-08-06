"""Sales Agent — request/response schemas matching the exact required output."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SalesRunIn(BaseModel):
    brief: str = Field(..., min_length=1, description="Lead context, question, or task for the Sales Agent")
    lead_name: str | None = None
    company: str | None = None
    existing_score: int | None = Field(None, ge=0, le=100, description="Real leads.score, if known")
    stage: str | None = None
    # Optional structured fit signals. When supplied, the random forest lead
    # scoring model (app/ml/lead_scoring_model.py) computes lead_score instead
    # of the LLM guessing a number — the LLM then reasons *about* that score
    # rather than inventing its own. All optional so existing callers that
    # only send free text keep working unchanged.
    org_size: str | None = Field(None, description="small | medium | enterprise")
    budget: str | None = Field(None, description="low | medium | high")
    channel: str | None = Field(None, description="email | webchat | instagram | whatsapp | linkedin")


class SalesRunOut(BaseModel):
    agent_type: str = "sales"
    lead_score: int = 0
    lead_qualification_reason: str = ""
    buying_intent_summary: str = ""
    recommended_sales_action: str = ""
    follow_up_message: str = ""
    opportunity_stage: str = ""
    forecast_impact: str = ""
    next_best_actions: list[Any] = Field(default_factory=list)
    follow_up_questions: list[Any] = Field(default_factory=list)
    human_handoff: bool = False
    knowledge_sources_used: list[str] = Field(default_factory=list)


class SalesRunSummary(BaseModel):
    id: uuid.UUID
    brief: str
    output: dict[str, Any]
    knowledge_sources_used: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class FitScoreIn(BaseModel):
    """Deliberately not free text: the Fit Scorer panel re-scores on every pill
    change, so this has to be a cheap deterministic call, not an LLM run."""
    org_size: str | None = None   # small | medium | enterprise
    budget: str | None = None     # low | medium | high
    channel: str | None = None    # email | whatsapp | linkedin


class FitScoreOut(BaseModel):
    score: int = 0
    tier: str = "cold"            # hot | warm | cold
    tier_reason: str = ""
    factors: list[Any] = Field(default_factory=list)
    recommended_action: str = ""


# ─── Sales Agent config (Pipeline Value + AI Confidence CTAs) ───────────────
# Backs the "Set Up Deal Values" and "Wire Confidence Signal" flows on the
# Sales Agent Overview tab, which used to be permanent placeholder text.

CONFIDENCE_SIGNAL_KEYS = ("lead_score_avg", "knowledge_coverage", "handoff_rate")


class ConfidenceSignal(BaseModel):
    key: str = Field(..., description=f"One of: {', '.join(CONFIDENCE_SIGNAL_KEYS)}")
    enabled: bool = True
    weight: float = Field(1.0, ge=0, le=10)


class SalesAgentConfigIn(BaseModel):
    """PATCH body. Both fields optional so a caller updating one CTA's
    setting doesn't have to resend the other — same COALESCE-style partial
    update pattern as PUT /leads/:id in contact-service."""
    deal_value_field: str | None = Field(
        None, description="A key from GET /leads/fields, e.g. 'deal_value' or 'score'. Empty string clears the mapping."
    )
    confidence_signals: list[ConfidenceSignal] | None = None


class SignalBreakdown(BaseModel):
    key: str
    label: str
    enabled: bool
    weight: float
    value: float | None = None   # this signal's own 0-100 reading, or None if not computable
    note: str | None = None


class SalesComputedMetrics(BaseModel):
    pipeline_value: float | None = None
    pipeline_value_currency: str = "USD"
    pipeline_value_note: str = "no deal-value field mapped yet"
    leads_with_deal_value: int = 0
    ai_confidence: int | None = None
    ai_confidence_note: str = "no confidence signal wired yet"
    signal_breakdown: list[SignalBreakdown] = Field(default_factory=list)


class SalesAgentConfigOut(BaseModel):
    deal_value_field: str | None = None
    confidence_signals: list[ConfidenceSignal] = Field(default_factory=list)
    computed: SalesComputedMetrics
    updated_at: datetime | None = None


class SalesQueueItem(BaseModel):
    id: str
    type: str            # follow_up | handoff
    title: str
    sub: str | None = None
    priority: str | None = None
    due_at: datetime | None = None


class SalesQueueOut(BaseModel):
    total: int
    items: list[SalesQueueItem]
    generated_at: datetime


class SalesExportOut(BaseModel):
    generated_at: datetime
    organization_id: uuid.UUID
    summary: dict[str, Any]
    leads: list[dict[str, Any]]
