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
