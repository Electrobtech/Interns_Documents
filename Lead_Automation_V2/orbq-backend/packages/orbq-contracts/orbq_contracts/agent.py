"""The public agent envelope — the contract between the frontend and Orbq.

Shared by all four services: `orbq-ai-agents` serializes it, the three agent
services produce the `CapabilityResult`s that compose into it.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class Workspace(StrEnum):
    MARKETING = "marketing"
    SALES = "sales"
    SUPPORT = "support"


class ExecutionStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    PARTIAL = "partial"           # some capabilities failed; §10.7
    PENDING_APPROVAL = "pending_approval"  # a success state, not an error
    FAILED = "failed"


class AgentContext(BaseModel):
    """Entity anchors the caller can supply. All optional — the orchestrator
    resolves what it needs and degrades loudly when it cannot (§7.4)."""

    contact_ids: list[uuid.UUID] = Field(default_factory=list)
    lead_id: uuid.UUID | None = None
    campaign_id: uuid.UUID | None = None
    conversation_id: uuid.UUID | None = None
    ticket_id: uuid.UUID | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class AgentRequest(BaseModel):
    session_id: uuid.UUID | None = None
    message: str = Field(min_length=1, max_length=8000)
    context: AgentContext = Field(default_factory=AgentContext)
    mode: Literal["sync", "async"] = "sync"
    stream: bool = False
    max_capabilities: int = Field(default=8, ge=1, le=20)

    @field_validator("message")
    @classmethod
    def _strip(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("message cannot be blank")
        return stripped


class KnowledgeCitation(BaseModel):
    source_id: uuid.UUID
    source_title: str
    chunk_id: uuid.UUID
    score: float = Field(ge=0.0, le=1.0)
    excerpt: str | None = None


class Alternative(BaseModel):
    option: str
    why_not: str


class Explanation(BaseModel):
    """Ships on every response — never optional (§9.2).

    Making this required is deliberate: explainability that is opt-in gets
    skipped under deadline, and a trace that was never written cannot be
    reconstructed later.
    """

    summary: str
    confidence: float = Field(ge=0.0, le=1.0)
    capabilities_used: list[str] = Field(default_factory=list)
    knowledge_used: list[KnowledgeCitation] = Field(default_factory=list)
    degraded_inputs: list[str] = Field(default_factory=list)
    alternatives: list[Alternative] = Field(default_factory=list)
    reasoning: str | None = None
    reasoning_trace_id: uuid.UUID | None = None


class ApprovalRef(BaseModel):
    id: uuid.UUID
    action_type: str
    status: str
    expires_at: datetime | None = None


class UsageStats(BaseModel):
    tokens_in: int = 0
    tokens_out: int = 0
    credits: int = 0
    duration_ms: int = 0
    llm_calls: int = 0


class AgentResponse(BaseModel):
    session_id: uuid.UUID
    execution_id: uuid.UUID
    status: ExecutionStatus
    output: dict[str, Any] = Field(default_factory=dict)
    explanation: Explanation
    approvals: list[ApprovalRef] = Field(default_factory=list)
    usage: UsageStats = Field(default_factory=UsageStats)
    created_at: datetime
