from __future__ import annotations

import logging

try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.main")

app = FastAPI(
    title="AI Lead Automation — Agent Backend",
    description=(
        "Enterprise backend for Marketing, Sales, and Support AI agents. "
        "Includes RAG, hybrid retrieval, reranking, human handoff, provider "
        "fallback, RBAC, audit logs, and analytics."
    ),
    version="2.0.0",
    docs_url="/ai-agents/docs",
    redoc_url="/ai-agents/redoc",
    openapi_url="/ai-agents/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
async def on_startup() -> None:
    from app.config.settings import get_settings
    from app.database.session import _engine

    settings = get_settings()
    logger.info(
        "app_startup version=2.0.0 llm_provider=%s fallback=%s db=%s",
        settings.LLM_PROVIDER,
        settings.LLM_FALLBACK_PROVIDER,
        settings.DATABASE_URL.split("@")[-1],  # log host only, not credentials
    )

    # Ensure pgvector extension is present (idempotent, harmless if already created).
    try:
        from sqlalchemy import text
        async with _engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        logger.info("postgres_extensions_ready vector=ok pg_trgm=ok")
    except Exception:
        logger.warning("postgres_extension_check_failed — ensure pgvector is installed", exc_info=True)

    # Invalidate the cached provider so a hot-reload picks up new env vars.
    from app.llm import factory as llm_factory
    llm_factory._cached_provider.cache_clear()
    logger.info("llm_provider_cache_cleared")


@app.get("/ai-agents/health")
async def health() -> dict:
    return {"status": "ok", "version": "2.0.0"}
