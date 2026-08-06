"""FastAPI dependency wiring.

Long-lived objects (LLM client, agent client, registry, Redis pool) are built
once at startup and held on `app.state`. Per-request objects (repositories,
orchestrator) are constructed per request because they bind a DB session.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_ai.client import LLMClient
from orbq_core.db.session import get_session
from orbq_core.tenancy import TenantContext, current_tenant

from .clients.agent_client import AgentServiceClient
from .config import Settings, get_settings
from .memory.manager import MemoryManager
from .orchestration.orchestrator import Orchestrator
from .orchestration.planner import Planner
from .orchestration.registry import CapabilityRegistry
from .rag.pipeline import IngestionPipeline
from .rag.retriever import KnowledgeRetriever

DbSession = Annotated[AsyncSession, Depends(get_session)]


def get_config() -> Settings:
    return get_settings()


def get_llm(request: Request) -> LLMClient:
    return request.app.state.llm


def get_redis(request: Request) -> Redis:
    return request.app.state.redis


def get_agent_client(request: Request) -> AgentServiceClient:
    return request.app.state.agent_client


def get_registry(request: Request) -> CapabilityRegistry:
    return request.app.state.registry


def get_tenant() -> TenantContext:
    """Tenant bound by TenantIsolationMiddleware. Raises if absent."""
    return current_tenant()


def get_retriever(
    db: DbSession,
    llm: Annotated[LLMClient, Depends(get_llm)],
    settings: Annotated[Settings, Depends(get_config)],
) -> KnowledgeRetriever:
    return KnowledgeRetriever(
        db,
        llm,
        rrf_k=settings.rag_rrf_k,
        mmr_lambda=settings.rag_mmr_lambda,
        confidence_threshold=settings.rag_confidence_threshold,
        llm_rerank=settings.rag_llm_rerank,
        rerank_candidates=settings.rag_rerank_candidates,
    )


def get_memory(
    db: DbSession,
    redis: Annotated[Redis, Depends(get_redis)],
    llm: Annotated[LLMClient, Depends(get_llm)],
) -> MemoryManager:
    return MemoryManager(db, redis, llm)


def get_pipeline(
    db: DbSession,
    llm: Annotated[LLMClient, Depends(get_llm)],
    settings: Annotated[Settings, Depends(get_config)],
) -> IngestionPipeline:
    return IngestionPipeline(
        db,
        llm,
        target_chars=settings.chunk_target_chars,
        overlap_chars=settings.chunk_overlap_chars,
        min_chars=settings.chunk_min_chars,
    )


def get_orchestrator(
    db: DbSession,
    llm: Annotated[LLMClient, Depends(get_llm)],
    registry: Annotated[CapabilityRegistry, Depends(get_registry)],
    agent_client: Annotated[AgentServiceClient, Depends(get_agent_client)],
    retriever: Annotated[KnowledgeRetriever, Depends(get_retriever)],
    memory: Annotated[MemoryManager, Depends(get_memory)],
) -> Orchestrator:
    return Orchestrator(
        db,
        registry=registry,
        planner=Planner(registry, llm),
        retriever=retriever,
        memory=memory,
        agent_client=agent_client,
    )
