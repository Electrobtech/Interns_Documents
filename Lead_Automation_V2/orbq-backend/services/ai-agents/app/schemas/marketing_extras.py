"""Schemas for Broadcasts, Content, Templates, SEO, AEO, Competitors,
Calendar, Reports, Assets — everything the Campaigns schema pattern didn't
already cover.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from ..models.marketing import (
    ASSET_TYPES,
    BROADCAST_CHANNELS,
    BROADCAST_STATUSES,
    CONTENT_TYPES,
    EVENT_TYPES,
    PLATFORMS,
    REPORT_TYPES,
)

Channel = Literal[BROADCAST_CHANNELS]  # type: ignore[valid-type]
BroadcastStatus = Literal[BROADCAST_STATUSES]  # type: ignore[valid-type]
ContentType = Literal[CONTENT_TYPES]  # type: ignore[valid-type]
AssetType = Literal[ASSET_TYPES]  # type: ignore[valid-type]
EventType = Literal[EVENT_TYPES]  # type: ignore[valid-type]
ReportType = Literal[REPORT_TYPES]  # type: ignore[valid-type]
Platform = Literal[PLATFORMS]  # type: ignore[valid-type]

# Legal broadcast transitions — mirrors the campaign pattern (§ change_campaign_status)
# even though broadcasts don't need a full workflow: draft -> scheduled/sending
# still needs to be a deliberate, server-enforced move, not an open field edit.
BROADCAST_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"scheduled", "sending", "cancelled"},
    "scheduled": {"sending", "cancelled", "draft"},
    "sending": {"sent", "failed", "paused"},
    "paused": {"sending", "cancelled"},
    "sent": set(),
    "failed": {"draft"},
    "cancelled": set(),
}


# ─── Broadcasts ──────────────────────────────────────────────────────────

class BroadcastCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    channel: Channel
    audience_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None
    subject: str | None = Field(default=None, max_length=300)
    body: str = Field(min_length=1)
    content: dict = Field(default_factory=dict)
    scheduled_at: datetime | None = None


class BroadcastUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    audience_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None
    subject: str | None = None
    body: str | None = None
    # `content` and `channel` are editable and, like `body`, invalidate any
    # prior policy verdict — see POLICY_INVALIDATING_FIELDS in broadcasts.py.
    content: dict | None = None
    channel: Channel | None = None
    scheduled_at: datetime | None = None


class BroadcastStatusChange(BaseModel):
    to_status: BroadcastStatus


class BroadcastOut(BaseModel):
    id: uuid.UUID
    name: str
    channel: str
    status: str
    audience_id: uuid.UUID | None
    template_id: uuid.UUID | None
    subject: str | None
    body: str
    scheduled_at: datetime | None
    sent_at: datetime | None
    policy_risk_level: str | None
    policy_risk_score: int | None
    policy_checked_at: datetime | None
    ai_generated: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BroadcastPolicyCheck(BaseModel):
    """Persists the anti_ban capability's verdict onto the broadcast row, so
    'safe to send' is a stored fact checked at send time, not just a one-off
    chat answer the marketer has to remember."""

    risk_level: Literal["low", "medium", "high", "critical"]
    risk_score: int = Field(ge=0, le=100)
    flags: list[dict] = Field(default_factory=list)


# ─── Content + Templates ─────────────────────────────────────────────────

class ContentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content_type: ContentType
    platform: Platform | None = None
    body: str = Field(min_length=1)
    variants: list[dict] = Field(default_factory=list)
    tone: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_template: bool = False
    claims_requiring_verification: list[str] = Field(default_factory=list)
    ai_execution_id: uuid.UUID | None = None
    ai_confidence: float | None = Field(default=None, ge=0, le=1)


class ContentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    body: str | None = None
    variants: list[dict] | None = None
    tone: str | None = None
    tags: list[str] | None = None
    # Indices into claims_requiring_verification that a human has checked.
    claims_verified: list[int] | None = None
    change_note: str | None = Field(default=None, max_length=500)


class ContentVersionOut(BaseModel):
    id: uuid.UUID
    version: int
    title: str
    body: str
    variants: list
    change_note: str | None
    created_at: datetime
    created_by: uuid.UUID | None

    model_config = {"from_attributes": True}


class ContentSubmitApproval(BaseModel):
    """Submitting for publish routes through the governance engine rather than
    a status field on the document — `content.publish` is on the auto-approval
    denylist, so it can never be machine-approved."""

    summary: str | None = Field(default=None, max_length=500)


class ContentOut(BaseModel):
    id: uuid.UUID
    title: str
    content_type: str
    platform: str | None
    body: str
    variants: list
    tone: str | None
    tags: list[str]
    version: int
    is_template: bool
    claims_requiring_verification: list
    claims_verified: list
    approval_id: uuid.UUID | None = None
    ai_generated: bool
    ai_confidence: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    template_type: ContentType
    channel: Platform | None = None
    subject: str | None = None
    body: str = Field(min_length=1)
    variables: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class TemplateUpdate(BaseModel):
    """The tab's defining gap: without this a template was create-once, then
    delete-and-recreate — which loses its id and usage count."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    template_type: ContentType | None = None
    channel: Platform | None = None
    subject: str | None = None
    body: str | None = Field(default=None, min_length=1)
    variables: list[str] | None = None
    tags: list[str] | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    template_type: str
    channel: str | None
    subject: str | None
    body: str
    variables: list
    tags: list[str]
    usage_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── SEO ─────────────────────────────────────────────────────────────────

class SEOProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    domain: str | None = None
    target_keywords: list[str] = Field(default_factory=list)


class SEOProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None
    target_keywords: list[str]
    last_audit_at: datetime | None
    latest_score: int | None
    keyword_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class SEOProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    domain: str | None = None
    target_keywords: list[str] | None = None
    # Written back after a re-audit. Without these, `last_audit_at` stays null
    # forever and "last audited" is permanently stale after the first run.
    latest_score: int | None = Field(default=None, ge=0, le=100)
    mark_audited: bool = False


class SEOProjectDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None
    target_keywords: list[str]
    last_audit_at: datetime | None
    latest_score: int | None
    keywords: list["SEOKeywordOut"] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class SEOKeywordUpdate(BaseModel):
    term: str | None = Field(default=None, min_length=1, max_length=200)
    intent: Literal["informational", "commercial", "transactional", "navigational"] | None = None
    priority: Literal["high", "medium", "low"] | None = None
    rationale: str | None = None
    # The one numeric a human plausibly knows, from checking Search Console.
    # Setting it flips data_source to "manual" so the badge stays truthful.
    current_rank: int | None = Field(default=None, ge=1, le=200)


class SEOKeywordCreate(BaseModel):
    term: str = Field(min_length=1, max_length=200)
    intent: Literal["informational", "commercial", "transactional", "navigational"] | None = None
    priority: Literal["high", "medium", "low"] | None = None
    rationale: str | None = None
    data_source: Literal["ai_inferred", "manual", "search_console"] = "ai_inferred"


class SEOKeywordOut(BaseModel):
    id: uuid.UUID
    term: str
    intent: str | None
    priority: str | None
    rationale: str | None
    search_volume: int | None
    difficulty: int | None
    current_rank: int | None
    data_source: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── AEO ─────────────────────────────────────────────────────────────────

class AEOProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    target_url: str | None = None
    answer_ready_summary: str | None = None
    structured_facts: list[str] = Field(default_factory=list)
    question_variants: list[str] = Field(default_factory=list)
    schema_suggestions: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    visibility_estimate: int | None = Field(default=None, ge=0, le=100)
    ai_execution_id: uuid.UUID | None = None


class AEOProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    target_url: str | None
    answer_ready_summary: str | None
    structured_facts: list
    question_variants: list
    schema_suggestions: list
    weaknesses: list
    visibility_estimate: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Competitors ─────────────────────────────────────────────────────────

class AEOProjectUpdate(BaseModel):
    """Every field the capability generates is editable — the point of AEO
    output is that a human refines it, and without a PUT the first generation
    was final."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    target_url: str | None = None
    answer_ready_summary: str | None = None
    structured_facts: list[str] | None = None
    question_variants: list[str] | None = None
    schema_suggestions: list[str] | None = None
    weaknesses: list[str] | None = None
    visibility_estimate: int | None = Field(default=None, ge=0, le=100)


class CompetitorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    domain: str | None = None
    positioning: str | None = None
    target_segments: list[str] | None = None


class CompetitorDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None
    positioning: str | None
    target_segments: list[str]
    last_analyzed_at: datetime | None
    snapshot_count: int = 0
    latest_snapshot: "CompetitorSnapshotOut | None" = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompetitorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    domain: str | None = None
    positioning: str | None = None
    target_segments: list[str] = Field(default_factory=list)


class CompetitorOut(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None
    positioning: str | None
    target_segments: list[str]
    last_analyzed_at: datetime | None
    snapshot_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class CompetitorSnapshotCreate(BaseModel):
    strengths: list[dict] = Field(default_factory=list)
    weaknesses: list[dict] = Field(default_factory=list)
    pricing_notes: list[dict] = Field(default_factory=list)
    own_swot: dict = Field(default_factory=dict)
    differentiation_angles: list[str] = Field(default_factory=list)
    unverified_claim_count: int = 0
    data_gaps: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)
    ai_execution_id: uuid.UUID | None = None


class CompetitorSnapshotOut(BaseModel):
    id: uuid.UUID
    strengths: list
    weaknesses: list
    pricing_notes: list
    own_swot: dict
    differentiation_angles: list
    unverified_claim_count: int
    data_gaps: list
    confidence: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Calendar ────────────────────────────────────────────────────────────

class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    event_type: EventType
    description: str | None = None
    start_at: datetime
    end_at: datetime | None = None
    all_day: bool = False
    campaign_id: uuid.UUID | None = None
    broadcast_id: uuid.UUID | None = None
    content_id: uuid.UUID | None = None
    recurrence_rule: str | None = None
    timezone: str = "Asia/Kolkata"


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None


class CalendarEventOut(BaseModel):
    id: uuid.UUID
    title: str
    event_type: str
    description: str | None
    start_at: datetime
    end_at: datetime | None
    all_day: bool
    campaign_id: uuid.UUID | None
    broadcast_id: uuid.UUID | None
    content_id: uuid.UUID | None
    recurrence_rule: str | None
    timezone: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Reports ─────────────────────────────────────────────────────────────

class ReportGenerate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    report_type: ReportType
    period_start: date | None = None
    period_end: date | None = None


class ReportOut(BaseModel):
    id: uuid.UUID
    name: str
    report_type: str
    period_start: date | None
    period_end: date | None
    status: str
    data: dict
    export_format: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Assets ──────────────────────────────────────────────────────────────

class AssetFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: uuid.UUID | None = None


class AssetFolderOut(BaseModel):
    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetOut(BaseModel):
    id: uuid.UUID
    name: str
    asset_type: str
    mime_type: str | None
    byte_size: int
    width: int | None
    height: int | None
    folder_id: uuid.UUID | None
    tags: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}
