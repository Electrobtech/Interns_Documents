from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    handoff,
    knowledge,
    marketing,
    marketing_analytics,
    marketing_audience,
    marketing_broadcasts,
    marketing_campaigns,
    marketing_channels,
    marketing_competitor,
    marketing_content,
    marketing_templates,
    marketing_assets,
    marketing_calendar,
    marketing_reports,
    marketing_knowledge,
    marketing_growth,
    marketing_handoff,
    marketing_performance,
    marketing_persona,
    marketing_planner,
    marketing_seo,
    memory,
    orchestrator,
    providers,
    rag,
    sales,
    support,
    system,
    webhooks,
)

router = APIRouter(prefix="/ai-agents")

router.include_router(system.router, tags=["system"])
router.include_router(knowledge.router, tags=["knowledge"])
router.include_router(rag.router, tags=["rag"])
router.include_router(marketing.router, tags=["marketing"])
router.include_router(marketing_content.router, tags=["marketing-content"])
router.include_router(marketing_campaigns.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_channels.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_broadcasts.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_audience.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_content.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_templates.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_assets.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_calendar.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_analytics.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_reports.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_knowledge.router, prefix="/marketing-hub", tags=["marketing-hub"])
router.include_router(marketing_seo.router, tags=["marketing"])
router.include_router(marketing_persona.router, tags=["marketing"])
router.include_router(marketing_planner.router, tags=["marketing"])
router.include_router(marketing_competitor.router, tags=["marketing"])
# AEO, anti-ban, click-to-WhatsApp and cold revival. This router existed
# but was never registered, so all six of its routes 404'd — including the
# ones the Marketing workspace panels call on mount.
router.include_router(marketing_growth.router, tags=["marketing"])
router.include_router(marketing_handoff.router, tags=["marketing"])
router.include_router(marketing_performance.router, tags=["marketing"])
router.include_router(sales.router, tags=["sales"])
router.include_router(support.router, tags=["support"])
router.include_router(orchestrator.router, tags=["orchestrator"])
router.include_router(handoff.router, tags=["handoff"])
router.include_router(memory.router, tags=["memory"])
router.include_router(analytics.router, tags=["analytics"])
router.include_router(providers.router, tags=["providers"])
router.include_router(webhooks.router, tags=["webhooks"])
