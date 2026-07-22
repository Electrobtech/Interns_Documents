"""Marketing Agent — request/response schemas. MarketingRunOut matches the
exact required output shape from the platform spec."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MarketingRunIn(BaseModel):
    brief: str = Field(..., min_length=1, description="Campaign brief / question / task for the Marketing Agent")


class MarketingRunOut(BaseModel):
    agent_type: str = "marketing"
    campaign_summary: str = ""
    audience_segments: list[Any] = Field(default_factory=list)
    seo_aeo_analysis: dict[str, Any] = Field(default_factory=dict)
    keyword_research: dict[str, Any] = Field(default_factory=dict)
    content_assets: dict[str, Any] = Field(default_factory=dict)
    sentiment_analysis: dict[str, Any] = Field(default_factory=dict)
    review_replies: list[Any] = Field(default_factory=list)
    performance_insights: dict[str, Any] = Field(default_factory=dict)
    next_best_actions: list[Any] = Field(default_factory=list)
    follow_up_questions: list[Any] = Field(default_factory=list)
    human_handoff: bool = False
    knowledge_sources_used: list[str] = Field(default_factory=list)


class MarketingRunSummary(BaseModel):
    id: uuid.UUID
    brief: str
    output: dict[str, Any]
    knowledge_sources_used: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}
