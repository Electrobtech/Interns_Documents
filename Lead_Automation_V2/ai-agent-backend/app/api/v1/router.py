from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    handoff,
    knowledge,
    marketing,
    marketing_competitor,
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
router.include_router(marketing_seo.router, tags=["marketing"])
router.include_router(marketing_persona.router, tags=["marketing"])
router.include_router(marketing_planner.router, tags=["marketing"])
router.include_router(marketing_competitor.router, tags=["marketing"])
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
