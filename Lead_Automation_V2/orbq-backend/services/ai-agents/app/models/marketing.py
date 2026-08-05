"""Marketing domain — the persistence layer behind the Marketing Hub.

**Scope decision (2026-08-05, supersedes the ADR-001 carve-out for marketing):**
Orbq owns the *entire* marketing lifecycle — plan, audience, content, schedule,
send, and per-recipient delivery state. The Node `campaign-service` /
`contact-service` path is not functional, so deferring to it would mean
deferring to something that does not run.

That makes this schema the single source of truth for marketing. It therefore
carries the parts a planning-only schema would have skipped:

  · `CampaignRecipient` / `BroadcastRecipient` — per-person delivery rows with
    attempt counts and provider message ids, so "did this actually send?" has
    exactly one answer.
  · `DeliveryEvent` — the append-only delivery/open/click trail that analytics
    aggregates from, rather than trusting mutable counters.

`external_*_id` columns remain for the channel provider's id (WhatsApp wamid,
email message-id), not for a Node row.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    Boolean,
    text,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orbq_core.db.base import OrbqTable

# ---------------------------------------------------------------------------
# Enumerations kept as CHECK constraints rather than PG ENUM types: adding a
# value to a native enum requires ALTER TYPE and a lock, whereas a CHECK is a
# cheap constraint swap. Marketing channels change often.
# ---------------------------------------------------------------------------

OBJECTIVES = (
    "lead_generation", "website_traffic", "sales", "engagement", "awareness",
    "event_registration", "webinar", "remarketing", "conversion",
)
PLATFORMS = (
    "facebook", "instagram", "linkedin", "google_ads", "whatsapp",
    "messenger", "telegram", "email", "sms", "web_push",
)
CAMPAIGN_STATUSES = (
    "draft", "pending_review", "approved", "scheduled",
    "running", "paused", "completed", "archived",
)
# Legal transitions. Enforced in the service so an invalid move is impossible
# rather than merely discouraged — same discipline as the approval engine.
CAMPAIGN_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"pending_review", "archived"},
    "pending_review": {"approved", "draft", "archived"},
    "approved": {"scheduled", "running", "draft", "archived"},
    "scheduled": {"running", "paused", "draft", "archived"},
    "running": {"paused", "completed", "archived"},
    "paused": {"running", "completed", "archived"},
    "completed": {"archived"},
    "archived": set(),
}
BUDGET_TYPES = ("daily", "lifetime")
BID_STRATEGIES = ("highest_volume", "lowest_cost", "target_cost", "cost_cap")
AUDIENCE_TYPES = ("custom", "lookalike", "saved", "rule_based")
BROADCAST_CHANNELS = ("whatsapp", "email", "sms", "telegram", "messenger")
BROADCAST_STATUSES = ("draft", "scheduled", "sending", "sent", "paused", "cancelled", "failed")
CONTENT_TYPES = (
    "ad_copy", "email", "whatsapp", "sms", "social_post",
    "blog", "landing_page", "product_description", "seo_meta",
)
ASSET_TYPES = ("image", "video", "pdf", "audio", "document", "icon", "logo")
EVENT_TYPES = ("campaign_launch", "broadcast", "meeting", "webinar", "reminder", "holiday", "content")
REPORT_TYPES = (
    "campaign_performance", "monthly_summary", "roi_analysis",
    "lead_report", "executive_summary", "seo", "aeo", "competitor",
)


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------


class MarketingCampaign(OrbqTable):
    """A campaign as the marketer designs it. Delivery lives in Node."""

    __tablename__ = "marketing_campaigns"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str] = mapped_column(String(32), nullable=False)
    platforms: Mapped[list[str]] = mapped_column(ARRAY(String(20)), nullable=False, default=list, server_default=text("'{}'"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", server_default="draft")

    budget_type: Mapped[str] = mapped_column(String(10), nullable=False, default="daily", server_default="daily")
    # Numeric, never float: money in binary floating point accumulates error,
    # and a budget that drifts by cents is a support ticket.
    budget_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR", server_default="INR")
    bid_strategy: Mapped[str] = mapped_column(String(24), nullable=False, default="highest_volume", server_default="highest_volume")

    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata", server_default="Asia/Kolkata")

    audience_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("marketing_audiences.id", ondelete="SET NULL")
    )
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), nullable=False, default=list, server_default=text("'{}'"))

    # ---- AI provenance -----------------------------------------------------
    # Set when the campaign came from `campaign_planner`, so the UI can show
    # "AI-drafted" and link back to the reasoning trace.
    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    ai_execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    ai_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3))

    # ---- Node hand-off -----------------------------------------------------
    # The campaign-service row that actually sends. Null until published.
    external_campaign_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tracking: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))  # UTM, pixel
    campaign_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))

    audience: Mapped["MarketingAudience | None"] = relationship(back_populates="campaigns")
    items: Mapped[list["CampaignItem"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan", lazy="selectin"
    )
    status_history: Mapped[list["CampaignStatusHistory"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(f"objective IN {OBJECTIVES}", name="mc_objective_valid"),
        CheckConstraint(f"status IN {CAMPAIGN_STATUSES}", name="mc_status_valid"),
        CheckConstraint(f"budget_type IN {BUDGET_TYPES}", name="mc_budget_type_valid"),
        CheckConstraint(f"bid_strategy IN {BID_STRATEGIES}", name="mc_bid_valid"),
        # Spec validation rules, enforced by the database rather than trusted
        # to the API layer.
        CheckConstraint("budget_amount > 0", name="mc_budget_positive"),
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date > start_date",
            name="mc_dates_ordered",
        ),
        CheckConstraint("array_length(platforms, 1) >= 1", name="mc_platform_required"),
        # "Duplicate Name Check" from the spec — scoped to live campaigns, so a
        # name frees up once archived.
        Index(
            "uq_marketing_campaigns_org_name",
            "org_id", "name", unique=True,
            postgresql_where=(
                "deleted_at IS NULL AND status <> 'archived'"
            ),
        ),
        Index("ix_marketing_campaigns_org_status", "org_id", "status", "created_at"),
        Index("ix_marketing_campaigns_org_objective", "org_id", "objective"),
    )

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in CAMPAIGN_TRANSITIONS.get(self.status, set())


class CampaignItem(OrbqTable):
    """One scheduled message within a campaign — the unit the planner emits."""

    __tablename__ = "marketing_campaign_items"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("marketing_campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    day_offset: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    subject: Mapped[str | None] = mapped_column(String(300))
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    call_to_action: Mapped[str | None] = mapped_column(String(120))
    audience_filter: Mapped[str | None] = mapped_column(Text)
    creative: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))

    campaign: Mapped[MarketingCampaign] = relationship(back_populates="items")

    __table_args__ = (
        CheckConstraint(f"channel IN {PLATFORMS}", name="mci_channel_valid"),
        Index("ix_campaign_items_campaign", "campaign_id", "sequence"),
    )


class CampaignStatusHistory(OrbqTable):
    """Append-only status trail. Answers "who paused this, and when?"."""

    __tablename__ = "marketing_campaign_status_history"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("marketing_campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    reason: Mapped[str | None] = mapped_column(Text)

    campaign: Mapped[MarketingCampaign] = relationship(back_populates="status_history")

    __table_args__ = (Index("ix_campaign_status_history", "campaign_id", "created_at"),)


# ---------------------------------------------------------------------------
# Audiences
# ---------------------------------------------------------------------------


class MarketingAudience(OrbqTable):
    """A targeting definition.

    Stores the *rule*, not the member list. Contacts live in Node's
    `contacts` table; materializing a copy here would be stale within minutes
    and would double the PII surface. `size` is a cached estimate with the
    timestamp of when it was computed, so the UI can show its age.
    """

    __tablename__ = "marketing_audiences"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    audience_type: Mapped[str] = mapped_column(String(16), nullable=False, default="rule_based", server_default="rule_based")

    # Nested AND/OR filter tree — see the filter engine in services/audiences.py.
    filters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), nullable=False, default=list, server_default=text("'{}'"))

    size: Mapped[int | None] = mapped_column(Integer)
    size_computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # For lookalikes: the audience this was modelled on.
    source_audience_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    ai_execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    campaigns: Mapped[list[MarketingCampaign]] = relationship(back_populates="audience")

    __table_args__ = (
        CheckConstraint(f"audience_type IN {AUDIENCE_TYPES}", name="ma_type_valid"),
        Index("uq_marketing_audiences_org_name", "org_id", "name", unique=True,
              postgresql_where="deleted_at IS NULL"),
        Index("ix_marketing_audiences_org_type", "org_id", "audience_type"),
    )


# ---------------------------------------------------------------------------
# Broadcasts
# ---------------------------------------------------------------------------


class Broadcast(OrbqTable):
    """A one-off send. Like campaigns, Orbq composes it; Node delivers it."""

    __tablename__ = "marketing_broadcasts"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft", server_default="draft")

    audience_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("marketing_audiences.id", ondelete="SET NULL")
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    subject: Mapped[str | None] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Result of the `anti_ban` pre-flight. A broadcast should not be sendable
    # while a block-level policy flag stands.
    policy_risk_level: Mapped[str | None] = mapped_column(String(10))
    policy_risk_score: Mapped[int | None] = mapped_column(Integer)
    policy_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    policy_flags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))

    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    ai_execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    external_broadcast_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    __table_args__ = (
        CheckConstraint(f"channel IN {BROADCAST_CHANNELS}", name="mb_channel_valid"),
        CheckConstraint(f"status IN {BROADCAST_STATUSES}", name="mb_status_valid"),
        CheckConstraint(
            "policy_risk_score IS NULL OR (policy_risk_score BETWEEN 0 AND 100)",
            name="mb_risk_range",
        ),
        Index("ix_marketing_broadcasts_org_status", "org_id", "status", "created_at"),
        Index("ix_marketing_broadcasts_scheduled", "org_id", "scheduled_at",
              postgresql_where="status = 'scheduled'"),
    )


# ---------------------------------------------------------------------------
# Delivery — Orbq owns sending, so it owns per-recipient state
# ---------------------------------------------------------------------------

DELIVERY_STATUSES = (
    "queued", "sending", "sent", "delivered", "read",
    "clicked", "replied", "failed", "bounced", "skipped",
)


class CampaignRecipient(OrbqTable):
    """One person, one campaign item, one send attempt trail.

    Kept separate from `DeliveryEvent` on purpose: this row is the *current*
    state a UI lists and filters on, while events are the immutable history.
    Deriving current state from events on every list query would be correct but
    far too slow at broadcast scale.
    """

    __tablename__ = "marketing_campaign_recipients"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("marketing_campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    campaign_item_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("marketing_campaign_items.id", ondelete="CASCADE"),
    )

    contact_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    # Denormalised so a send does not need a second lookup, and so the trail
    # survives the contact being edited or removed.
    destination: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(200))

    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued", server_default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    last_error: Mapped[str | None] = mapped_column(Text)

    provider_message_id: Mapped[str | None] = mapped_column(String(200))
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(f"status IN {DELIVERY_STATUSES}", name="mcr_status_valid"),
        CheckConstraint("attempts >= 0", name="mcr_attempts_non_negative"),
        # The single most important constraint in the delivery layer: one
        # message per contact per item. A retry storm or a double-click on
        # "Send" cannot message the same person twice.
        Index(
            "uq_campaign_recipient_once",
            "campaign_item_id", "destination", unique=True,
            postgresql_where="campaign_item_id IS NOT NULL",
        ),
        Index("ix_campaign_recipients_org_status", "org_id", "status"),
        Index("ix_campaign_recipients_campaign", "campaign_id", "status"),
        # Drives the sender: the next batch due to go out.
        Index(
            "ix_campaign_recipients_due", "scheduled_for",
            postgresql_where="status = 'queued'",
        ),
    )


class BroadcastRecipient(OrbqTable):
    """Same shape as CampaignRecipient, for one-off broadcasts."""

    __tablename__ = "marketing_broadcast_recipients"

    broadcast_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("marketing_broadcasts.id", ondelete="CASCADE"),
        nullable=False,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    destination: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(200))

    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued", server_default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    last_error: Mapped[str | None] = mapped_column(Text)

    provider_message_id: Mapped[str | None] = mapped_column(String(200))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(f"status IN {DELIVERY_STATUSES}", name="mbr_status_valid"),
        Index("uq_broadcast_recipient_once", "broadcast_id", "destination", unique=True),
        Index("ix_broadcast_recipients_org_status", "org_id", "status"),
        Index("ix_broadcast_recipients_broadcast", "broadcast_id", "status"),
    )


class DeliveryEvent(OrbqTable):
    """Append-only delivery history — the source analytics aggregates from.

    Providers deliver webhooks out of order and more than once. Reconstructing
    "opened 3 times" from a mutable counter loses that; an event log does not.
    `provider_event_id` gives idempotency on redelivery.
    """

    __tablename__ = "marketing_delivery_events"

    recipient_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    broadcast_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    event_type: Mapped[str] = mapped_column(String(16), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    provider_message_id: Mapped[str | None] = mapped_column(String(200))
    provider_event_id: Mapped[str | None] = mapped_column(String(200))
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    error_detail: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(f"event_type IN {DELIVERY_STATUSES}", name="mde_type_valid"),
        # A redelivered webhook must not double-count an open.
        Index(
            "uq_delivery_event_provider", "org_id", "provider_event_id", unique=True,
            postgresql_where="provider_event_id IS NOT NULL",
        ),
        Index("ix_delivery_events_campaign", "campaign_id", "occurred_at"),
        Index("ix_delivery_events_broadcast", "broadcast_id", "occurred_at"),
        Index("ix_delivery_events_org_type", "org_id", "event_type", "occurred_at"),
    )


# ---------------------------------------------------------------------------
# Content, templates, assets
# ---------------------------------------------------------------------------


class ContentDoc(OrbqTable):
    """A piece of marketing copy, versioned."""

    __tablename__ = "marketing_content"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(20))

    body: Mapped[str] = mapped_column(Text, nullable=False)
    variants: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    tone: Mapped[str | None] = mapped_column(String(40))
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), nullable=False, default=list, server_default=text("'{}'"))

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    is_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    approval_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    # Claims the agent could not ground. Surfaced in the editor so a human
    # verifies them before anything is published.
    claims_requiring_verification: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list
    )

    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    ai_execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    ai_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3))

    __table_args__ = (
        CheckConstraint(f"content_type IN {CONTENT_TYPES}", name="mcd_type_valid"),
        Index("ix_marketing_content_org_type", "org_id", "content_type", "created_at"),
    )


class Template(OrbqTable):
    __tablename__ = "marketing_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    template_type: Mapped[str] = mapped_column(String(32), nullable=False)
    channel: Mapped[str | None] = mapped_column(String(20))
    subject: Mapped[str | None] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), nullable=False, default=list, server_default=text("'{}'"))
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        Index("uq_marketing_templates_org_name", "org_id", "name", unique=True,
              postgresql_where="deleted_at IS NULL"),
    )


class AssetFolder(OrbqTable):
    __tablename__ = "marketing_asset_folders"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("marketing_asset_folders.id", ondelete="CASCADE")
    )

    __table_args__ = (Index("ix_asset_folders_org_parent", "org_id", "parent_id"),)


class Asset(OrbqTable):
    """File metadata. Bytes live in object storage; this row is the index."""

    __tablename__ = "marketing_assets"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(16), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(120))
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    thumbnail_key: Mapped[str | None] = mapped_column(String(500))

    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("marketing_asset_folders.id", ondelete="SET NULL")
    )
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), nullable=False, default=list, server_default=text("'{}'"))

    # Null until scanned. The upload path must refuse to serve a signed URL
    # for an unscanned file rather than assuming it is clean.
    virus_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    virus_scan_result: Mapped[str | None] = mapped_column(String(20))

    __table_args__ = (
        CheckConstraint(f"asset_type IN {ASSET_TYPES}", name="masset_type_valid"),
        Index("ix_marketing_assets_org_folder", "org_id", "folder_id"),
        Index("ix_marketing_assets_org_type", "org_id", "asset_type"),
    )


# ---------------------------------------------------------------------------
# Calendar, reports
# ---------------------------------------------------------------------------


class CalendarEvent(OrbqTable):
    __tablename__ = "marketing_calendar_events"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    event_type: Mapped[str] = mapped_column(String(24), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))

    campaign_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    broadcast_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    content_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    # RFC 5545 RRULE. Stored as text rather than expanded into rows: expanding
    # a "weekly forever" rule would generate unbounded data.
    recurrence_rule: Mapped[str | None] = mapped_column(String(200))
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata", server_default="Asia/Kolkata")

    __table_args__ = (
        CheckConstraint(f"event_type IN {EVENT_TYPES}", name="mce_type_valid"),
        CheckConstraint("end_at IS NULL OR end_at >= start_at", name="mce_dates_ordered"),
        Index("ix_calendar_events_org_range", "org_id", "start_at", "end_at"),
    )


class Report(OrbqTable):
    __tablename__ = "marketing_reports"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    report_type: Mapped[str] = mapped_column(String(32), nullable=False)
    period_start: Mapped[datetime | None] = mapped_column(Date)
    period_end: Mapped[datetime | None] = mapped_column(Date)

    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", server_default="pending")
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    export_key: Mapped[str | None] = mapped_column(String(500))
    export_format: Mapped[str | None] = mapped_column(String(10))

    schedule_rule: Mapped[str | None] = mapped_column(String(200))
    ai_execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    __table_args__ = (
        CheckConstraint(f"report_type IN {REPORT_TYPES}", name="mr_type_valid"),
        Index("ix_marketing_reports_org_type", "org_id", "report_type", "created_at"),
    )


# ---------------------------------------------------------------------------
# SEO / AEO / Competitor persistence
# ---------------------------------------------------------------------------


class SEOProject(OrbqTable):
    __tablename__ = "marketing_seo_projects"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(300))
    target_keywords: Mapped[list[str]] = mapped_column(ARRAY(String(120)), nullable=False, default=list, server_default=text("'{}'"))
    last_audit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latest_score: Mapped[int | None] = mapped_column(Integer)

    keywords: Mapped[list["SEOKeyword"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("uq_seo_projects_org_name", "org_id", "name", unique=True,
              postgresql_where="deleted_at IS NULL"),
    )


class SEOKeyword(OrbqTable):
    """A keyword the agent proposed.

    `search_volume` and `difficulty` are nullable and stay null: Orbq has no
    keyword tool, and a fabricated volume is worse than an empty column
    because someone will plan against it.
    """

    __tablename__ = "marketing_seo_keywords"

    project_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("marketing_seo_projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    term: Mapped[str] = mapped_column(String(200), nullable=False)
    intent: Mapped[str | None] = mapped_column(String(20))
    priority: Mapped[str | None] = mapped_column(String(10))
    rationale: Mapped[str | None] = mapped_column(Text)

    search_volume: Mapped[int | None] = mapped_column(Integer)
    difficulty: Mapped[int | None] = mapped_column(Integer)
    current_rank: Mapped[int | None] = mapped_column(Integer)
    data_source: Mapped[str] = mapped_column(String(24), nullable=False, default="ai_inferred", server_default="ai_inferred")

    project: Mapped[SEOProject] = relationship(back_populates="keywords")

    __table_args__ = (
        Index("uq_seo_keywords_project_term", "project_id", "term", unique=True),
        Index("ix_seo_keywords_org", "org_id", "created_at"),
    )


class AEOProject(OrbqTable):
    __tablename__ = "marketing_aeo_projects"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_url: Mapped[str | None] = mapped_column(String(500))
    answer_ready_summary: Mapped[str | None] = mapped_column(Text)
    structured_facts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    question_variants: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    schema_suggestions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    weaknesses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))

    # Self-assessed by the model, NOT measured against real answer engines.
    # Named `_estimate` so nobody mistakes it for a measurement.
    visibility_estimate: Mapped[int | None] = mapped_column(Integer)
    ai_execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    __table_args__ = (
        Index("uq_aeo_projects_org_name", "org_id", "name", unique=True,
              postgresql_where="deleted_at IS NULL"),
    )


class Competitor(OrbqTable):
    __tablename__ = "marketing_competitors"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(300))
    positioning: Mapped[str | None] = mapped_column(Text)
    target_segments: Mapped[list[str]] = mapped_column(ARRAY(String(80)), nullable=False, default=list, server_default=text("'{}'"))
    last_analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    snapshots: Mapped[list["CompetitorSnapshot"]] = relationship(
        back_populates="competitor", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("uq_competitors_org_name", "org_id", "name", unique=True,
              postgresql_where="deleted_at IS NULL"),
    )


class CompetitorSnapshot(OrbqTable):
    """A point-in-time analysis.

    `unverified_claim_count` is stored, not derived, because it is the single
    number that tells a user how much of this to trust — and it must survive
    even if the claim payload is later trimmed.
    """

    __tablename__ = "marketing_competitor_snapshots"

    competitor_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("marketing_competitors.id", ondelete="CASCADE"),
        nullable=False,
    )
    strengths: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    weaknesses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    pricing_notes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    own_swot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    differentiation_angles: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))

    unverified_claim_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    data_gaps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    confidence: Mapped[float | None] = mapped_column(Numeric(4, 3))
    ai_execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    competitor: Mapped[Competitor] = relationship(back_populates="snapshots")

    __table_args__ = (
        Index("ix_competitor_snapshots", "competitor_id", "created_at"),
    )
