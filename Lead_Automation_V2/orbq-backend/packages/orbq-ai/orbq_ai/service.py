"""Shared FastAPI app factory for the three agent services.

All three are structurally identical — a capability registry behind an internal
API — so they share one factory. A behavioral difference between Marketing,
Sales, and Support should come from their capabilities, never from divergent
bootstrap code.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request

from orbq_core.config import BaseServiceSettings
from orbq_core.db.session import dispose_engine, init_engine
from orbq_core.logging import configure_logging
from orbq_core.middleware import install_middleware

from .capability import BaseCapability, CapabilityRegistry
from .client import LLMClient, build_provider_chain

log = structlog.get_logger()


class AgentServiceSettings(BaseServiceSettings):
    """Settings shared by marketing / sales / support."""

    ai_agents_service_url: str = "http://orbq-ai-agents:4020"

    llm_provider: str = "groq"
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Measured choice, not a default: qwen3.6-27b fails Groq strict JSON mode,
    # which every capability depends on.
    groq_model: str = "llama-3.3-70b-versatile"
    ollama_host: str = "http://ollama:11434"
    ollama_model: str = "qwen3:8b"
    embedding_model: str = "nomic-embed-text"


def create_agent_service(
    *,
    title: str,
    settings: AgentServiceSettings,
    capabilities: list[type[BaseCapability]],
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        configure_logging(settings)
        init_engine(settings)

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
        # Raises on duplicate names or an unresolvable `requires` — a bad
        # registry fails at startup, not on a user's request.
        app.state.registry = CapabilityRegistry(capabilities, app.state.llm)

        log.info(
            "service_started",
            service=settings.service_name,
            capabilities=len(app.state.registry),
            model=settings.groq_model,
        )
        yield
        await dispose_engine()
        log.info("service_stopped", service=settings.service_name)

    app = FastAPI(
        title=title,
        description="Internal capability host. Not gateway-routed.",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
    )

    install_middleware(app, settings)

    from .internal_api import router as internal_router

    app.include_router(internal_router)

    @app.get("/health/live", tags=["health"])
    async def live() -> dict:
        return {"status": "alive"}

    @app.get("/health/ready", tags=["health"])
    async def ready(request: Request) -> dict:
        # Checks only this service's own state. It deliberately does NOT probe
        # orbq-ai-agents: a service reporting unready because a peer is down
        # turns a partial outage into a total one (§21.6).
        registry = getattr(request.app.state, "registry", None)
        return {
            "status": "ready" if registry else "not_ready",
            "capabilities": len(registry) if registry else 0,
        }

    return app
