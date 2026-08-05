"""Pydantic request/response schemas for the Campaigns API.

Separate from the ORM models on purpose: the wire contract and the storage
model change for different reasons, and coupling them means every DB tweak
risks becoming an API break.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from ..models.marketing import (
    BID_STRATEGIES,
    BUDGET_TYPES,
    CAMPAIGN_STATUSES,
    OBJECTIVES,
    PLATFORMS,
)

Objective = Literal[OBJECTIVES]  # type: ignore[valid-type]
Platform = Literal[PLATFORMS]  # type: ignore[valid-type]
CampaignStatus = Literal[CAMPAIGN_STATUSES]  # type: ignore[valid-type]
BudgetType = Literal[BUDGET_TYPES]  # type: ignore[valid-type]
BidStrategy = Literal[BID_STRATEGIES]  # type: ignore[valid-type]


class CampaignItemIn(BaseModel):
    sequence: int = 0
    channel: Platform
    day_offset: int = 0
    subject: str | None = Field(default=None, max_length=300)
    message_body: str = Field(min_length=1)
    call_to_action: str | None = Field(default=None, max_length=120)
    audience_filter: str | None = None


class CampaignItemOut(CampaignItemIn):
    id: uuid.UUID
    created_at: datetime


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    objective: Objective
    platforms: list[Platform] = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)

    budget_type: BudgetType = "daily"
    budget_amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    bid_strategy: BidStrategy = "highest_volume"

    start_date: datetime | None = None
    end_date: datetime | None = None
    timezone: str = "Asia/Kolkata"

    audience_id: uuid.UUID | None = None
    tracking: dict = Field(default_factory=dict)
    items: list[CampaignItemIn] = Field(default_factory=list)

    @field_validator("end_date")
    @classmethod
    def _dates_ordered(cls, v: datetime | None, info) -> datetime | None:
        start = info.data.get("start_date")
        if v and start and v <= start:
            raise ValueError("end_date must be after start_date")
        return v

    @field_validator("platforms")
    @classmethod
    def _dedupe_platforms(cls, v: list[str]) -> list[str]:
        seen = list(dict.fromkeys(v))  # preserves order, matches spec's "duplicate check"
        if not seen:
            raise ValueError("at least one platform is required")
        return seen


class CampaignUpdate(BaseModel):
    """All optional — PATCH semantics. Status changes go through the
    dedicated /status endpoint so the transition table (§ CAMPAIGN_TRANSITIONS)
    is always consulted, never bypassed by a generic field update."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    objective: Objective | None = None
    platforms: list[Platform] | None = Field(default=None, min_length=1)
    tags: list[str] | None = None
    budget_type: BudgetType | None = None
    budget_amount: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    bid_strategy: BidStrategy | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    timezone: str | None = None
    audience_id: uuid.UUID | None = None
    tracking: dict | None = None


class StatusChangeRequest(BaseModel):
    to_status: CampaignStatus
    reason: str | None = Field(default=None, max_length=500)


class CampaignOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    objective: str
    platforms: list[str]
    status: str
    tags: list[str]

    budget_type: str
    budget_amount: Decimal
    currency: str
    bid_strategy: str

    start_date: datetime | None
    end_date: datetime | None
    timezone: str

    audience_id: uuid.UUID | None
    ai_generated: bool
    ai_execution_id: uuid.UUID | None
    ai_confidence: float | None

    external_campaign_id: uuid.UUID | None
    published_at: datetime | None

    tracking: dict
    item_count: int = 0

    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID | None

    model_config = {"from_attributes": True}


class CampaignDetailOut(CampaignOut):
    items: list[CampaignItemOut] = Field(default_factory=list)


class CampaignListOut(BaseModel):
    items: list[CampaignOut]
    total: int
    page: int
    limit: int


class StatusHistoryOut(BaseModel):
    from_status: str | None
    to_status: str
    actor_id: uuid.UUID | None
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AudienceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    audience_type: Literal["custom", "lookalike", "saved", "rule_based"] = "rule_based"
    filters: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class AudienceOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    audience_type: str
    filters: dict
    tags: list[str]
    size: int | None
    size_computed_at: datetime | None
    ai_generated: bool
    created_at: datetime

    model_config = {"from_attributes": True}
