"""Marketing Agent expansion — request/response schemas for SEO briefs,
personas, campaign plans, and competitor reports."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# SEO
# ---------------------------------------------------------------------------


class SeoBriefIn(BaseModel):
    topic: str = Field(..., min_length=1, description="Topic or goal to research")


class SeoBriefOut(BaseModel):
    id: uuid.UUID
    topic: str
    primary_keywords: list[Any] = Field(default_factory=list)
    long_tail_keywords: list[Any] = Field(default_factory=list)
    search_intent: dict[str, Any] = Field(default_factory=dict)
    content_brief: dict[str, Any] = Field(default_factory=dict)
    on_page_recommendations: list[Any] = Field(default_factory=list)
    knowledge_sources_used: list[str] = Field(default_factory=list)
    created_at: datetime


class SeoBriefSummary(BaseModel):
    id: uuid.UUID
    topic: str
    output: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Personas / ICP
# ---------------------------------------------------------------------------


class PersonaIn(BaseModel):
    brief: str = Field(..., min_length=1, description="Who to build a persona for / what segment")
    name: str | None = Field(None, description="Optional label to save this persona set under")


class PersonaOut(BaseModel):
    id: uuid.UUID
    name: str
    personas: list[Any] = Field(default_factory=list)
    knowledge_sources_used: list[str] = Field(default_factory=list)
    created_at: datetime


class PersonaSummary(BaseModel):
    id: uuid.UUID
    name: str
    output: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Campaign planner
# ---------------------------------------------------------------------------


class CampaignPlanIn(BaseModel):
    name: str = Field(..., min_length=1, description="Label for this plan")
    goal: str = Field(..., min_length=1)
    timeframe: str = Field(..., min_length=1, description="e.g. '4 weeks', 'Q1 launch'")
    channels: list[str] = Field(default_factory=list)
    persona: str | None = None


class CampaignPlanOut(BaseModel):
    id: uuid.UUID
    name: str
    goal: str | None = None
    timeframe: str | None = None
    plan_summary: str = ""
    items: list[Any] = Field(default_factory=list)
    knowledge_sources_used: list[str] = Field(default_factory=list)
    created_at: datetime


class CampaignPlanSummary(BaseModel):
    id: uuid.UUID
    name: str
    goal: str | None = None
    timeframe: str | None = None
    output: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ConvertPlanItemIn(BaseModel):
    channel_type: str = Field(..., min_length=1)
    message_body: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Competitor intelligence
# ---------------------------------------------------------------------------


class CompetitorIntelIn(BaseModel):
    subject: str = Field(..., min_length=1, description="Category, market, or named competitor to reason about")


class CompetitorIntelOut(BaseModel):
    id: uuid.UUID
    subject: str
    disclaimer: str = ""
    positioning_summary: str = ""
    likely_competitor_angles: list[Any] = Field(default_factory=list)
    differentiation_suggestions: list[Any] = Field(default_factory=list)
    content_gaps: list[Any] = Field(default_factory=list)
    knowledge_sources_used: list[str] = Field(default_factory=list)
    created_at: datetime


class CompetitorReportSummary(BaseModel):
    id: uuid.UUID
    subject: str
    output: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Sales handoff
# ---------------------------------------------------------------------------


class SalesHandoffIn(BaseModel):
    campaign_id: uuid.UUID | None = Field(None, description="Focus on one campaign; omit for recent campaigns")
    note: str | None = Field(None, description="Optional extra context for the brief")


class SalesHandoffOut(BaseModel):
    handoff_id: uuid.UUID
    campaign_data: list[dict[str, Any]]
    summary: str = ""
    headline_stat: str = ""
    recommended_next_step: str = ""


# ---------------------------------------------------------------------------
# AEO — Answer Engine Optimization (growth expansion)
# ---------------------------------------------------------------------------


class AeoIn(BaseModel):
    copy: str = Field(..., min_length=1, description="Marketing copy or topic to optimize for AI answer-engine citation")


class AeoOut(BaseModel):
    id: uuid.UUID
    input_text: str
    aeo_score: int = 0
    score_reason: str = ""
    optimized_copy: str = ""
    citation_hooks: list[Any] = Field(default_factory=list)
    structured_qa: list[Any] = Field(default_factory=list)
    entities_to_emphasize: list[Any] = Field(default_factory=list)
    improvements: list[Any] = Field(default_factory=list)
    quick_wins: list[Any] = Field(default_factory=list)
    knowledge_sources_used: list[str] = Field(default_factory=list)
    created_at: datetime


class AeoSummary(BaseModel):
    id: uuid.UUID
    input_text: str
    output: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Anti-Ban — Meta/WhatsApp deliverability pre-flight (stateless, no persistence)
# ---------------------------------------------------------------------------


class AntiBanIn(BaseModel):
    draft: str = Field(..., min_length=1, description="Broadcast/message draft to pre-flight check")
    channel: str = Field("whatsapp", description="Channel the broadcast targets")
    recent_sends_note: str | None = Field(None, description="Optional note about recent sends to this segment for frequency reasoning")


class AntiBanOut(BaseModel):
    spam_risk_score: int = 0
    risk_level: str = "low"
    verdict: str = "safe_to_send"
    policy_flags: list[Any] = Field(default_factory=list)
    spam_trigger_words: list[Any] = Field(default_factory=list)
    template_category: dict[str, Any] = Field(default_factory=dict)
    opt_out_present: bool = False
    frequency_warning: str = ""
    safe_rewrite: str = ""
    recommendations: list[Any] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Click-to-WhatsApp ad package (growth expansion)
# ---------------------------------------------------------------------------


class CtwaIn(BaseModel):
    offer_brief: str = Field(..., min_length=1, description="The product/offer to promote via a Click-to-WhatsApp ad")


class CtwaOut(BaseModel):
    id: uuid.UUID
    offer_brief: str
    primary_texts: list[Any] = Field(default_factory=list)
    headlines: list[Any] = Field(default_factory=list)
    descriptions: list[Any] = Field(default_factory=list)
    cta_button: dict[str, Any] = Field(default_factory=dict)
    instant_greeting: str = ""
    qualifying_questions: list[Any] = Field(default_factory=list)
    prefilled_message: str = ""
    targeting_notes: list[Any] = Field(default_factory=list)
    compliance_notes: list[Any] = Field(default_factory=list)
    knowledge_sources_used: list[str] = Field(default_factory=list)
    created_at: datetime


class CtwaSummary(BaseModel):
    id: uuid.UUID
    offer_brief: str
    output: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Cold Lead Revival Radar (growth expansion — reads live leads, no persistence)
# ---------------------------------------------------------------------------


class ColdRevivalIn(BaseModel):
    dormant_days: int = Field(30, ge=1, le=365, description="A lead is 'dormant' if inactive for at least this many days")
    note: str | None = Field(None, description="Optional extra context for the revival drip")


class DormantLeadOut(BaseModel):
    name: str = ""
    source: str = ""
    days_inactive: int = 0


class ColdRevivalOut(BaseModel):
    dormant_count: int = 0
    dormant_days: int = 30
    dormant_leads: list[DormantLeadOut] = Field(default_factory=list)
    revival_summary: str = ""
    segment_insight: str = ""
    drip_sequence: list[Any] = Field(default_factory=list)
    channel_recommendation: str = ""
    best_send_window: str = ""
    do_not_do: list[Any] = Field(default_factory=list)
    expected_outcome: str = ""
    knowledge_sources_used: list[str] = Field(default_factory=list)
