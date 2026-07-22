"""Support Agent — request/response schemas matching the exact required output."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SupportRunIn(BaseModel):
    brief: str = Field(..., min_length=1, description="Customer message / question / issue")
    customer_name: str | None = None
    channel: str | None = None  # whatsapp | instagram | email | webchat | ...
    session_id: str | None = None  # ties into shared conversation memory


class SupportRunOut(BaseModel):
    agent_type: str = "support"
    issue_summary: str = ""
    suggested_reply: str = ""
    ticket_category: str = ""
    priority_level: str = ""
    escalation_needed: bool = False
    knowledge_base_references: list[Any] = Field(default_factory=list)
    resolution_steps: list[Any] = Field(default_factory=list)
    csat_risk: str = ""
    human_handoff_note: str = ""
    follow_up_questions: list[Any] = Field(default_factory=list)
    human_handoff: bool = False
    knowledge_sources_used: list[str] = Field(default_factory=list)


class SupportRunSummary(BaseModel):
    id: uuid.UUID
    brief: str
    output: dict[str, Any]
    knowledge_sources_used: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}
