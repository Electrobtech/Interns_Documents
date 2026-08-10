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
    """PATCH body. All fields optional so a caller updating one setting
    doesn't have to resend the others — same COALESCE-style partial update
    pattern as PUT /leads/:id in contact-service."""
    deal_value_field: str | None = Field(
        None, description="A key from GET /leads/fields, e.g. 'deal_value' or 'score'. Empty string clears the mapping."
    )
    confidence_signals: list[ConfidenceSignal] | None = None

    # ── Settings tab ──────────────────────────────────────────────────────
    min_hot_score: int | None = Field(None, ge=0, le=100, description="Score at/above which a lead is classified 'Hot'.")
    max_followup_attempts: int | None = Field(None, ge=1, le=20)
    require_approval: bool | None = None
    followup_cadence_days: list[int] | None = Field(
        None, description="Day-offsets a follow-up fires on, e.g. [1, 3, 7, 14]."
    )

    # ── Forecasting tab gap analysis ─────────────────────────────────────
    monthly_revenue_target: float | None = Field(None, ge=0, description="Empty/omitted leaves unset; 0 is a valid target.")
    product_targets: dict[str, float] | None = Field(
        None,
        description=(
            "Per-product monthly revenue targets: {product_id: target}. "
            "Sibling to monthly_revenue_target (org-wide), not derived from "
            "it. Omit to leave unchanged; send {} to clear all product "
            "targets. product_id must be a real id from GET /products."
        ),
    )


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
    min_hot_score: int = 75
    max_followup_attempts: int = 5
    require_approval: bool = True
    followup_cadence_days: list[int] = Field(default_factory=lambda: [1, 3, 7, 14])
    monthly_revenue_target: float | None = None
    product_targets: dict[str, float] = Field(default_factory=dict)
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


# ─── Forecasting tab ─────────────────────────────────────────────────────────
# GET /ai-agents/sales/forecast — replaces the Forecasting tab's hardcoded
# "$340K"/"$1.24M"/static paragraph with numbers derived from real leads
# (contact-service) plus the org's own configured target.

class StageForecast(BaseModel):
    stage: str
    label: str
    count: int
    value: float | None = None          # sum of deal_value_field for this stage, or None if unmapped
    win_probability: float              # heuristic 0-1, documented in SalesService._STAGE_WIN_PROBABILITY
    weighted_value: float | None = None  # value * win_probability, or None if value is None


class MonthlyRevenuePoint(BaseModel):
    month: str            # "2026-06"
    label: str            # "Jun"
    closed_value: float   # sum of deal_value_field for leads won that month (0 if unmapped/none)


class RevenueGap(BaseModel):
    target: float | None = None
    actual_mtd: float | None = None
    gap: float | None = None            # target - actual_mtd; None if either side is unknown
    pct_of_target: float | None = None  # actual_mtd / target * 100
    note: str


class ProductForecast(BaseModel):
    """Requirement 4 — per-product breakdown of pipeline, MTD sales, and
    gap-to-target, so target setting / tracking / gap analysis (requirements
    1-3) aren't only available org-wide. One entry per product returned by
    campaign-service's GET /products, plus a trailing "unassigned" entry for
    leads with no product_id (see infra/db/migrations/032_lead_product_id.sql)
    — surfaced rather than silently dropped, so an org can see how much of
    its pipeline still needs categorizing."""
    product_id: str | None = None       # None only for the "unassigned" bucket
    product_name: str
    product_category: str | None = None
    open_deal_count: int
    pipeline_value: float | None = None       # sum of deal_value_field across this product's open leads
    revenue_gap: RevenueGap


class SalesForecastOut(BaseModel):
    generated_at: datetime
    deal_value_field: str | None = None
    pipeline_by_stage: list[StageForecast]
    weighted_pipeline_value: float | None = None   # sum of weighted_value across open stages, or None if unmapped
    monthly_revenue: list[MonthlyRevenuePoint]
    quarterly_prediction: float | None = None       # weighted_pipeline_value, this quarter's read
    revenue_gap: RevenueGap
    pipeline_by_product: list[ProductForecast] = Field(default_factory=list)
    explanation: str


# ─── Analytics tab ───────────────────────────────────────────────────────────
# GET /ai-agents/sales/analytics — replaces the Analytics tab's hardcoded
# metrics/charts with real aggregates from leads + sales_agent_runs + handoffs.

class WeeklyDealsPoint(BaseModel):
    week: str    # "2026-W31"
    label: str   # "W31"
    count: int


class AgentProductivityLine(BaseModel):
    name: str
    count: int


class SalesAnalyticsOut(BaseModel):
    generated_at: datetime
    deals_closed_mtd: int
    deals_closed_mtd_delta: int | None = None  # vs previous month; None if not enough history
    avg_deal_size: float | None = None         # None if deal_value_field unmapped or no won leads
    avg_deal_size_note: str
    sales_cycle_days: float | None = None      # avg(updated_at - created_at) over won leads, a proxy metric
    sales_cycle_note: str
    weekly_deals_won: list[WeeklyDealsPoint]
    agent_productivity: list[AgentProductivityLine]
    ai_resolution_rate: float | None = None    # % of runs that did NOT need a human handoff


# ─── Follow-up draft generation (Follow-ups tab) ────────────────────────────
# POST /ai-agents/sales/draft-followup — generates email/WhatsApp/call-script
# drafts for one lead. Read-only, same as /sales/fit-score and /sales/run:
# never sends anything itself. Sending happens via the existing
# POST /conversations/:id/reply once a human clicks Approve & Send.

class DraftFollowupIn(BaseModel):
    lead_id: str | None = Field(None, description="A real leads.id — if given, the lead's own record enriches the prompt.")
    lead_name: str | None = None
    company: str | None = None
    stage: str | None = None
    score: int | None = Field(None, ge=0, le=100)
    channel: str | None = Field(None, description="email | whatsapp | linkedin | webchat | instagram")
    notes: str | None = Field(None, description="Free-text context — e.g. what a rep already knows about this lead.")


class FollowupDraft(BaseModel):
    subject: str | None = None   # email only
    body: str = ""


class DraftFollowupOut(BaseModel):
    lead_name: str | None = None
    email: FollowupDraft
    whatsapp: FollowupDraft
    call_script: FollowupDraft
    knowledge_sources_used: list[str] = Field(default_factory=list)
