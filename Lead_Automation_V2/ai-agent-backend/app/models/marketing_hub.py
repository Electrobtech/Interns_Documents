"""Marketing Hub Models - REAL database models matching actual schema"""
from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import List, Optional
from enum import Enum

from sqlalchemy import DateTime, String, Text, Boolean, Integer, Numeric, ARRAY, Enum as SQLEnum, Date
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from app.models.base import Base


# Enums
class ChannelType(str, Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"  
    SMS = "sms"
    MESSENGER = "messenger"
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"


class ChannelStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    CONNECTING = "connecting"


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    QUEUED = "queued" 
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    ARCHIVED = "archived"


class CampaignType(str, Enum):
    CAMPAIGN = "campaign"
    BROADCAST = "broadcast"


class CampaignObjective(str, Enum):
    LEAD_GENERATION = "lead_generation"
    BRAND_AWARENESS = "brand_awareness"
    SALES = "sales"
    TRAFFIC = "traffic"


class BroadcastStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENDING = "sending"
    SENT = "sent"
    PAUSED = "paused"
    FAILED = "failed"


class BroadcastType(str, Enum):
    ONE_OFF = "one_off"
    RECURRING = "recurring"


class ContentStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"


class AssetType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio" 
    DOCUMENT = "document"
    TEMPLATE = "template"
    OTHER = "other"


class ContentType(str, Enum):
    POST = "post"
    EMAIL = "email"
    AD = "ad"
    BLOG = "blog"
    SOCIAL = "social"
    VIDEO = "video"
    IMAGE = "image"


class EventType(str, Enum):
    CAMPAIGN = "campaign"
    LAUNCH = "launch"
    DEADLINE = "deadline"
    MEETING = "meeting" 
    CONTENT_CREATION = "content_creation"
    REVIEW = "review"
    SOCIAL_POST = "social_post"


class EventStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ReportType(str, Enum):
    CAMPAIGN_PERFORMANCE = "campaign_performance"
    CHANNEL_ANALYSIS = "channel_analysis"
    AUDIENCE_INSIGHTS = "audience_insights"
    ROI_ANALYSIS = "roi_analysis"
    ENGAGEMENT_SUMMARY = "engagement_summary"
    CONVERSION_FUNNEL = "conversion_funnel"
    COMPREHENSIVE = "comprehensive"


class ReportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# Models - matching actual database schema
class MarketingCampaign(Base):
    __tablename__ = "mh_campaigns"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)  # campaign | broadcast
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[ChannelType] = mapped_column(SQLEnum(ChannelType), nullable=False)
    objective: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    audience_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    message_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    budget_amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[CampaignStatus] = mapped_column(SQLEnum(CampaignStatus), default=CampaignStatus.DRAFT)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    delivered_count: Mapped[int] = mapped_column(Integer, default=0)
    read_count: Mapped[int] = mapped_column(Integer, default=0)
    replied_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MarketingAudience(Base):
    __tablename__ = "mh_audiences"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(100), default='custom')  # custom | pixel | lookalike | import | crm
    filter: Mapped[dict] = mapped_column(JSONB, default={})  # filter criteria
    size_cached: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    size_computed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default='active')
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Recipients for campaigns/broadcasts
class MarketingRecipient(Base):
    __tablename__ = "mh_recipients"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)  # phone/email/handle
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rendered_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default='queued')  # queued | sending | sent | delivered | read | replied | failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    job_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    replied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MarketingAsset(Base):
    __tablename__ = "marketing_assets"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(SQLEnum(AssetType), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=[])
    metadata_dict: Mapped[dict] = mapped_column("metadata", JSONB, default={})
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MarketingTemplate(Base):
    __tablename__ = "marketing_templates"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    channel: Mapped[ChannelType] = mapped_column(SQLEnum(ChannelType), nullable=False)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    preview_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=[])
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MarketingContent(Base):
    __tablename__ = "marketing_content"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[ContentType] = mapped_column(SQLEnum(ContentType), nullable=False)
    channel: Mapped[Optional[ChannelType]] = mapped_column(SQLEnum(ChannelType), nullable=True)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default='draft')
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=[])
    performance_data: Mapped[dict] = mapped_column(JSONB, default={})
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MarketingCalendarEvent(Base):
    __tablename__ = "marketing_calendar_events"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_type: Mapped[EventType] = mapped_column(SQLEnum(EventType), nullable=False)
    status: Mapped[EventStatus] = mapped_column(SQLEnum(EventStatus), default=EventStatus.SCHEDULED)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    assignees: Mapped[List[str]] = mapped_column(ARRAY(String), default=[])
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=[])
    metadata_dict: Mapped[dict] = mapped_column("metadata", JSONB, default={})
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MarketingReport(Base):
    __tablename__ = "marketing_reports"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_type: Mapped[ReportType] = mapped_column(SQLEnum(ReportType), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    filters: Mapped[dict] = mapped_column(JSONB, default={})
    configuration: Mapped[dict] = mapped_column(JSONB, default={})
    content: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[ReportStatus] = mapped_column(SQLEnum(ReportStatus), default=ReportStatus.PENDING)
    recipients: Mapped[List[str]] = mapped_column(ARRAY(String), default=[])
    schedule: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Channel Management
class MarketingChannel(Base):
    __tablename__ = "marketing_channels"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_type: Mapped[ChannelType] = mapped_column(SQLEnum(ChannelType), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default='inactive')  # active | inactive | error | connecting
    configuration: Mapped[dict] = mapped_column(JSONB, default={})
    credentials: Mapped[dict] = mapped_column(JSONB, default={})
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    usage_stats: Mapped[dict] = mapped_column(JSONB, default={})
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())