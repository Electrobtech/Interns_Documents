"""Hybrid retrieval: wide vector-similarity candidate set from Postgres,
combined-score rerank (vector cosine + keyword ts_rank + exact-term boost),
dedup near-identical chunks, and a confidence gate — if nothing clears the
bar, the caller should ask a clarifying question instead of guessing.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.factory import get_embedding_provider
from app.repositories.knowledge_repo import KnowledgeRepository

_LOW_CONFIDENCE_THRESHOLD = 0.35
_DEDUP_SIMILARITY = 0.92


@dataclass
class RetrievedChunk:
    id: str
    knowledge_source_id: str
    content: str
    metadata: dict
    score: float


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _token_overlap(a: str, b: str) -> float:
    ta, tb = set(_normalize(a).split()), set(_normalize(b).split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


class KnowledgeRetriever:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = KnowledgeRepository(session)

    async def retrieve(
        self, organization_id: uuid.UUID, agent_type: str, query: str, top_k: int = 5,
    ) -> tuple[list[RetrievedChunk], bool]:
        """Returns (chunks, low_confidence). low_confidence=True means the
        caller should ask a clarifying question rather than trust the answer."""
        embedder = get_embedding_provider()
        [query_embedding] = await embedder.embed([query])

        candidates = await self._repo.hybrid_search(organization_id, agent_type, query_embedding, query, top_k=top_k)
        if not candidates:
            return [], True

        # Rerank: weighted combination of vector similarity + keyword rank,
        # with a small boost for exact query-term overlap (favors chunks
        # containing the literal names/numbers/terms the user asked about).
        reranked = []
        for row in candidates:
            vector_score = float(row["vector_score"] or 0)
            keyword_score = min(float(row["keyword_score"] or 0) * 4, 1.0)  # ts_rank is small-magnitude
            exact_overlap = _token_overlap(query, row["content"])
            combined = (0.6 * vector_score) + (0.25 * keyword_score) + (0.15 * exact_overlap)
            reranked.append((combined, row))

        reranked.sort(key=lambda x: x[0], reverse=True)

        # Dedup near-identical chunks (keep the highest-scored copy).
        seen_normalized: list[str] = []
        deduped: list[RetrievedChunk] = []
        for score, row in reranked:
            norm = _normalize(row["content"])
            if any(_token_overlap(norm, s) >= _DEDUP_SIMILARITY for s in seen_normalized):
                continue
            seen_normalized.append(norm)
            deduped.append(RetrievedChunk(
                id=str(row["id"]), knowledge_source_id=str(row["knowledge_source_id"]),
                content=row["content"], metadata=row["metadata"] or {}, score=round(score, 4),
            ))
            if len(deduped) >= top_k:
                break

        low_confidence = not deduped or deduped[0].score < _LOW_CONFIDENCE_THRESHOLD
        return deduped, low_confidence

    @staticmethod
    def format_context(chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return "(no relevant knowledge found)"
        parts = []
        for i, c in enumerate(chunks, start=1):
            loc = c.metadata.get("page") and f"p.{c.metadata['page']}" or c.metadata.get("heading") or ""
            parts.append(f"[{i}]{f' ({loc})' if loc else ''} {c.content}")
        return "\n\n".join(parts)
