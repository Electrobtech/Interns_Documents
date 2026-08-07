"""Marketing Hub Schemas - Pydantic models for API requests/responses"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.models.marketing_hub import (
    CampaignType, CampaignStatus, CampaignObjective, ChannelType, BroadcastType, BroadcastStatus,
    ContentType, ContentStatus
)


# ── Campaign Schemas ─────────────────────────────────────────────────────────


class CampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    type: CampaignType
    objective: CampaignObjective
    budget_total: Optional[float] = Field(None, ge=0)
    budget_daily: Optional[float] = Field(None, ge=0)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    target_audience_id: Optional[uuid.UUID] = None
    channels: List[str] = Field(default_factory=list)
    settings: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[CampaignStatus] = None
    budget_total: Optional[float] = Field(None, ge=0)
    budget_daily: Optional[float] = Field(None, ge=0)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    target_audience_id: Optional[uuid.UUID] = None
    channels: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


class CampaignOut(CampaignBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    workspace_id: Optional[uuid.UUID]
    status: CampaignStatus
    budget_spent: float
    metrics: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID
    updated_by: uuid.UUID
    version: int

    class Config:
        from_attributes = True


class CampaignSummary(BaseModel):
    id: uuid.UUID
    name: str
    type: CampaignType
    status: CampaignStatus
    objective: CampaignObjective
    budget_total: Optional[float]
    budget_spent: float
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    channels: List[str]
    metrics: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignMetrics(BaseModel):
    impressions: int = 0
    clicks: int = 0
    conversions: int = 0
    spend: float = 0.0
    ctr: float = 0.0
    cpc: float = 0.0
    cpm: float = 0.0
    roas: float = 0.0
    conversion_rate: float = 0.0


# ── Channel Schemas ──────────────────────────────────────────────────────────


class ChannelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: ChannelType
    settings: Dict[str, Any] = Field(default_factory=dict)
    daily_limit: Optional[int] = Field(None, ge=0)
    monthly_limit: Optional[int] = Field(None, ge=0)


class ChannelCreate(ChannelBase):
    credentials: Dict[str, Any] = Field(default_factory=dict)


class ChannelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    settings: Optional[Dict[str, Any]] = None
    daily_limit: Optional[int] = Field(None, ge=0)
    monthly_limit: Optional[int] = Field(None, ge=0)
    credentials: Optional[Dict[str, Any]] = None


class ChannelOut(ChannelBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    status: str
    current_usage: int
    metrics: Dict[str, Any]
    last_sync: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Audience Schemas ─────────────────────────────────────────────────────────


class AudienceSegmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    criteria: Dict[str, Any]
    is_dynamic: bool = True
    tags: List[str] = Field(default_factory=list)


class AudienceSegmentCreate(AudienceSegmentBase):
    pass


class AudienceSegmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    criteria: Optional[Dict[str, Any]] = None
    is_dynamic: Optional[bool] = None
    tags: Optional[List[str]] = None


class AudienceSegmentOut(AudienceSegmentBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    estimated_size: Optional[int]
    actual_size: Optional[int]
    last_calculated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID

    class Config:
        from_attributes = True


# ── Broadcast Schemas ────────────────────────────────────────────────────────


class BroadcastBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: BroadcastType
    channel: ChannelType
    content: Dict[str, Any]
    campaign_id: Optional[uuid.UUID] = None
    template_id: Optional[uuid.UUID] = None
    audience_segment_id: Optional[uuid.UUID] = None
    scheduled_at: Optional[datetime] = None
    settings: Dict[str, Any] = Field(default_factory=dict)


class BroadcastCreate(BroadcastBase):
    pass


class BroadcastUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[BroadcastStatus] = None
    content: Optional[Dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None
    settings: Optional[Dict[str, Any]] = None


class BroadcastOut(BroadcastBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    status: BroadcastStatus
    sent_at: Optional[datetime]
    metrics: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID

    class Config:
        from_attributes = True


# ── Content Studio Schemas ───────────────────────────────────────────────────


class ContentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: ContentType
    channel: Optional[ChannelType] = None
    content: Dict[str, Any]
    ai_prompt: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)
    category: Optional[str] = None


class ContentCreate(ContentBase):
    pass


class ContentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[ContentStatus] = None
    content: Optional[Dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None


class ContentOut(ContentBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    status: ContentStatus
    ai_generated: bool
    published_at: Optional[datetime]
    performance: Dict[str, Any]
    usage_count: int
    parent_id: Optional[uuid.UUID]
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID
    updated_by: uuid.UUID

    class Config:
        from_attributes = True


# ── Template Schemas ─────────────────────────────────────────────────────────


class TemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str
    channel: ChannelType
    content: Dict[str, Any]
    preview_data: Optional[Dict[str, Any]] = None
    is_public: bool = False
    tags: List[str] = Field(default_factory=list)


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    preview_data: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None
    tags: Optional[List[str]] = None


class TemplateOut(TemplateBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    usage_count: int
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID

    class Config:
        from_attributes = True


# ── Pagination and Filters ───────────────────────────────────────────────────


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(25, ge=1, le=100)


class CampaignFilters(BaseModel):
    status: Optional[CampaignStatus] = None
    type: Optional[CampaignType] = None
    objective: Optional[CampaignObjective] = None
    channel: Optional[str] = None
    start_date_from: Optional[datetime] = None
    start_date_to: Optional[datetime] = None
    tags: Optional[List[str]] = None
    search: Optional[str] = None


class ContentFilters(BaseModel):
    status: Optional[ContentStatus] = None
    type: Optional[ContentType] = None
    channel: Optional[ChannelType] = None
    category: Optional[str] = None
    ai_generated: Optional[bool] = None
    tags: Optional[List[str]] = None
    search: Optional[str] = None


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    limit: int
    total_pages: int