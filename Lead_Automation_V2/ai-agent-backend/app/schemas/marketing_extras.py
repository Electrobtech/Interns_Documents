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
