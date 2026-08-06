"""Marketing capability registry.

ALL_CAPABILITIES is the single list the service exposes. Adding a capability =
write the class, add it here. Nothing else changes — not the API, not the
orchestrator, not the gateway, not the frontend.
"""
from __future__ import annotations

from .campaign_planner import CampaignPlannerCapability
from .competitor_intel import CompetitorIntelCapability
from .content_generator import ContentGeneratorCapability
from .growth import (
    AEOCapability,
    AntiBanCapability,
    BrandToneCapability,
    ColdRevivalCapability,
    ContentCalendarCapability,
    CTWACapability,
    SentimentCapability,
)
from .persona import PersonaCapability
from .seo import SEOCapability

ALL_CAPABILITIES = [
    CampaignPlannerCapability,
    SEOCapability,
    AEOCapability,
    PersonaCapability,
    CompetitorIntelCapability,
    ContentGeneratorCapability,
    CTWACapability,
    BrandToneCapability,
    SentimentCapability,
    ContentCalendarCapability,
    AntiBanCapability,
    ColdRevivalCapability,
]

__all__ = ["ALL_CAPABILITIES"]
