"""orbq-ai-agents — the platform core.

Owns the three public agent endpoints, sessions, RAG, memory, workflow,
governance, and analytics. The agent tier (marketing/sales/support) is reachable
only from here, never from the gateway.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from redis.asyncio import Redis

from orbq_ai.client import LLMClient, build_provider_chain
from orbq_core.db.session import dispose_engine, init_engine
from orbq_core.logging import configure_logging
from orbq_core.middleware import install_middleware

from .api.v1 import (
    agents,
    approvals,
    assets,
    broadcasts,
    calendar,
    campaigns,
    content,
    dashboard,
    health,
    intelligence,
    knowledge,
    reports,
)
from .clients.agent_client import AgentServiceClient
from .config import get_settings
from .orchestration.registry import CapabilityRegistry

log = structlog.get_logger()

REGISTRY_REFRESH_SECONDS = 300


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings)

    init_engine(settings)

    app.state.redis = Redis.from_url(str(settings.redis_url), decode_responses=True)

    generation, embedder = build_provider_chain(
        primary=settings.llm_provider,
        groq_api_key=settings.groq_api_key,
        groq_base_url=settings.groq_base_url,
        groq_model=settings.groq_model,
        ollama_host=settings.ollama_host,
        ollama_model=settings.ollama_model,
        embedding_model=settings.embedding_model,
    )
    app.state.llm = LLMClient(generation, embedder)

    app.state.agent_client = AgentServiceClient(
        urls={
            "marketing": settings.marketing_service_url,
            "sales": settings.sales_service_url,
            "support": settings.support_service_url,
        },
        signing_key=settings.internal_signing_key,
        timeout=settings.agent_service_timeout,
    )
    app.state.registry = CapabilityRegistry(app.state.agent_client)

    # Discovery must not block startup: if an agent service is slow to come up,
    # this pod should still become ready and serve the dashboard. The refresh
    # loop picks the capabilities up as soon as they answer.
    async def refresh_loop() -> None:
        while True:
            try:
                await app.state.registry.refresh()
            except Exception as exc:  # noqa: BLE001
                log.warning("registry_refresh_error", error=str(exc))
            await asyncio.sleep(REGISTRY_REFRESH_SECONDS)

    app.state.registry_task = asyncio.create_task(refresh_loop())
    log.info("service_started", service=settings.service_name, port=settings.port)

    yield

    app.state.registry_task.cancel()
    try:
        await app.state.registry_task
    except asyncio.CancelledError:
        pass
    await app.state.redis.aclose()
    await dispose_engine()
    log.info("service_stopped", service=settings.service_name)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Orbq — AI Agents",
        description=(
            "The AI layer. Three public agent endpoints; every specialized "
            "capability is dispatched internally by the orchestrator."
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
    )

    install_middleware(app, settings)

    # Public surface. `tests/test_public_surface.py` asserts this list does not
    # grow without an explicit allowlist edit (§9.3).
    # Mounted at root, not /api/v1: the Node api-gateway forwards the path
    # unchanged (see api-gateway/src/index.js route table), so /ai-agents/status
    # must resolve here as /ai-agents/status.
    app.include_router(health.router)
    app.include_router(agents.router)
    app.include_router(agents.router_sessions)
    app.include_router(dashboard.router)
    app.include_router(knowledge.router)
    app.include_router(approvals.router)

    # Marketing Hub domain APIs.
    app.include_router(campaigns.router)
    app.include_router(broadcasts.router)
    app.include_router(content.router)
    app.include_router(intelligence.router)
    app.include_router(calendar.router)
    app.include_router(reports.router)
    app.include_router(assets.router)

    return app


app = create_app()
