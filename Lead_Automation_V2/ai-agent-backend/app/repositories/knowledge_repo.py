from __future__ import annotations

import uuid

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeChunk, KnowledgeSource


class KnowledgeRepository:
    # Cached process-wide once known — pgvector availability can't change
    # mid-run, and checking on every search would add a round-trip to the
    # hot path.
    _has_vector_type: bool | None = None

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _vector_available(self) -> bool:
        if KnowledgeRepository._has_vector_type is None:
            row = (await self._session.execute(
                text("SELECT 1 FROM pg_type WHERE typname = 'vector'")
            )).first()
            KnowledgeRepository._has_vector_type = row is not None
        return KnowledgeRepository._has_vector_type

    async def create_source(
        self, organization_id: uuid.UUID, agent_type: str, name: str, source_type: str, source_metadata: dict
    ) -> KnowledgeSource:
        source = KnowledgeSource(
            organization_id=organization_id, agent_type=agent_type, name=name,
            source_type=source_type, status="processing", source_metadata=source_metadata,
        )
        self._session.add(source)
        await self._session.flush()
        return source

    async def mark_ready(self, source_id: uuid.UUID, chunk_count: int) -> None:
        source = await self._session.get(KnowledgeSource, source_id)
        if source:
            source.status = "ready"
            source.chunk_count = chunk_count

    async def mark_failed(self, source_id: uuid.UUID, error_detail: str) -> None:
        source = await self._session.get(KnowledgeSource, source_id)
        if source:
            source.status = "failed"
            source.error_detail = error_detail

    async def add_chunk(
        self, organization_id: uuid.UUID, source_id: uuid.UUID, agent_type: str,
        chunk_index: int, content: str, embedding: list[float] | None, metadata: dict,
    ) -> None:
        self._session.add(KnowledgeChunk(
            organization_id=organization_id, knowledge_source_id=source_id, agent_type=agent_type,
            chunk_index=chunk_index, content=content, embedding=embedding, metadata_=metadata,
        ))

    async def list_sources(self, organization_id: uuid.UUID, agent_type: str | None = None) -> list[KnowledgeSource]:
        stmt = select(KnowledgeSource).where(KnowledgeSource.organization_id == organization_id)
        if agent_type:
            stmt = stmt.where(KnowledgeSource.agent_type == agent_type)
        stmt = stmt.order_by(KnowledgeSource.created_at.desc())
        return list((await self._session.execute(stmt)).scalars().all())

    async def delete_source(self, organization_id: uuid.UUID, source_id: uuid.UUID) -> None:
        await self._session.execute(
            delete(KnowledgeSource).where(
                KnowledgeSource.id == source_id, KnowledgeSource.organization_id == organization_id
            )
        )

    async def delete_chunks_for_source(self, source_id: uuid.UUID) -> None:
        await self._session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.knowledge_source_id == source_id))

    async def hybrid_search(
        self, organization_id: uuid.UUID, agent_type: str, query_embedding: list[float], query_text: str, top_k: int = 8,
    ) -> list[dict]:
        """Wide-candidate hybrid retrieval: cosine similarity (vector) + ts_rank
        (keyword), combined with a weighted sum, then deduplicated by near-identical
        content. Returns richer candidate set than final top_k for the caller to rerank."""
        candidate_k = max(top_k * 3, 20)

        if not await self._vector_available():
            # pgvector isn't installed on this Postgres — embedding is a
            # plain TEXT column (see the 0001 migration's fallback), so
            # cosine similarity isn't possible. Fall back to keyword-only
            # (ts_rank) search rather than crashing on an `::vector` cast
            # against a type that doesn't exist in this database.
            rows = (await self._session.execute(
                text("""
                    SELECT id, knowledge_source_id, content, metadata,
                           0 AS vector_score,
                           ts_rank(content_tsv, plainto_tsquery('english', :query_text)) AS keyword_score
                      FROM knowledge_chunks
                     WHERE organization_id = :org_id AND agent_type = :agent_type
                     ORDER BY keyword_score DESC
                     LIMIT :candidate_k
                """),
                {"org_id": str(organization_id), "agent_type": agent_type,
                 "query_text": query_text, "candidate_k": candidate_k},
            )).mappings().all()
            return [dict(r) for r in rows]

        vector_literal = "[" + ",".join(str(x) for x in query_embedding) + "]"

        # True hybrid: take the top candidates from EACH retriever and union
        # them, rather than ranking by vector alone and letting keyword score
        # only reshuffle that list. Previously a chunk that was an exact
        # keyword hit but a mediocre vector match could never enter the
        # candidate pool at all, so lexical matches on names, SKUs, and error
        # codes were unreachable. Each arm also reports its own rank so the
        # caller can fuse by rank (RRF) instead of by incomparable raw scores.
        rows = (await self._session.execute(
            text("""
                WITH vec AS (
                    SELECT id, knowledge_source_id, content, metadata,
                           1 - (embedding <=> (:vector)::vector) AS vector_score,
                           ROW_NUMBER() OVER (ORDER BY embedding <=> (:vector)::vector) AS vector_rank
                      FROM knowledge_chunks
                     WHERE organization_id = :org_id AND agent_type = :agent_type
                       AND embedding IS NOT NULL
                     ORDER BY embedding <=> (:vector)::vector
                     LIMIT :candidate_k
                ),
                kw AS (
                    SELECT id, knowledge_source_id, content, metadata,
                           ts_rank(content_tsv, plainto_tsquery('english', :query_text)) AS keyword_score,
                           ROW_NUMBER() OVER (
                               ORDER BY ts_rank(content_tsv, plainto_tsquery('english', :query_text)) DESC
                           ) AS keyword_rank
                      FROM knowledge_chunks
                     WHERE organization_id = :org_id AND agent_type = :agent_type
                       AND content_tsv @@ plainto_tsquery('english', :query_text)
                     ORDER BY keyword_score DESC
                     LIMIT :candidate_k
                )
                SELECT COALESCE(v.id, k.id)                             AS id,
                       COALESCE(v.knowledge_source_id, k.knowledge_source_id) AS knowledge_source_id,
                       COALESCE(v.content, k.content)                   AS content,
                       COALESCE(v.metadata, k.metadata)                 AS metadata,
                       COALESCE(v.vector_score, 0)                      AS vector_score,
                       COALESCE(k.keyword_score, 0)                     AS keyword_score,
                       v.vector_rank                                    AS vector_rank,
                       k.keyword_rank                                   AS keyword_rank
                  FROM vec v
                  FULL OUTER JOIN kw k ON k.id = v.id
            """),
            {
                "vector": vector_literal, "org_id": str(organization_id), "agent_type": agent_type,
                "query_text": query_text, "candidate_k": candidate_k,
            },
        )).mappings().all()

        return [dict(r) for r in rows]

    async def chunk_count_for_org(self, organization_id: uuid.UUID, agent_type: str) -> int:
        result = await self._session.execute(
            select(func.count()).select_from(KnowledgeChunk).where(
                KnowledgeChunk.organization_id == organization_id, KnowledgeChunk.agent_type == agent_type
            )
        )
        return result.scalar_one()
