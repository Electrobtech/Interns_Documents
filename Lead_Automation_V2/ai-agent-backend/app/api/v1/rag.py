"""Standalone RAG query endpoint — retrieve + rerank chunks from the
knowledge base without invoking a full agent. Useful for debugging
retrieval quality, building custom UIs, or powering search features."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.tenant_scope import get_scoped_session
from app.knowledge.retriever import KnowledgeRetriever, RetrievedChunk

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RAGQueryIn(BaseModel):
    query: str = Field(..., min_length=1, description="The search query to retrieve context for")
    agent_type: str = Field(..., description="Which knowledge scope to search: marketing | sales | support")
    top_k: int = Field(default=5, ge=1, le=20, description="Maximum number of chunks to return")


class ChunkOut(BaseModel):
    id: str
    knowledge_source_id: str
    content: str
    metadata: dict[str, Any]
    score: float


class RAGQueryOut(BaseModel):
    query: str
    agent_type: str
    low_confidence: bool
    chunks: list[ChunkOut]
    formatted_context: str


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/rag/query", response_model=RAGQueryOut)
async def rag_query(
    body: RAGQueryIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_scoped_session),
) -> RAGQueryOut:
    """Run hybrid retrieval + reranking against the knowledge base and return
    the ranked chunks with their scores. Does NOT call an LLM."""
    organization_id = uuid.UUID(user.organization_id)
    retriever = KnowledgeRetriever(session)
    chunks, low_confidence = await retriever.retrieve(
        organization_id, body.agent_type, body.query, top_k=body.top_k
    )
    return RAGQueryOut(
        query=body.query,
        agent_type=body.agent_type,
        low_confidence=low_confidence,
        chunks=[
            ChunkOut(
                id=c.id,
                knowledge_source_id=c.knowledge_source_id,
                content=c.content,
                metadata=c.metadata,
                score=c.score,
            )
            for c in chunks
        ],
        formatted_context=retriever.format_context(chunks),
    )
