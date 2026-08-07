"""Hybrid retrieval pipeline.

Stages, in order:

1. **Dual candidate generation** — vector (pgvector/HNSW cosine) and keyword
   (``ts_rank`` over a GIN-indexed tsvector) are queried independently and
   unioned, so a chunk only one of them can find is still reachable.
2. **RRF fusion** — the two arms are combined by *rank*, not by raw score.
   Cosine similarity lives in 0..1 while ``ts_rank`` is a small, corpus- and
   query-dependent magnitude; adding them directly (the previous approach, with
   a ``* 4`` fudge factor and a clamp) let one arm silently dominate whenever
   the corpus changed. Reciprocal Rank Fusion is scale-free.
3. **Exact-term boost** — a small nudge for literal query-term overlap, which
   matters for names, SKUs, and error codes.
4. **Optional LLM cross-encoder rerank** — off by default (one extra LLM call).
   A cross-encoder reads query and passage *together*, so it is far more precise
   than the bi-encoder similarity used for candidate generation.
5. **MMR diversification** — greedy relevance-vs-redundancy selection, so the
   top-k is not three paraphrases of the same paragraph while the one chunk
   holding the actual answer sits at position four.
6. **Confidence gate** — if nothing clears the bar the caller should ask a
   clarifying question rather than answer from weak evidence.
"""
from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.knowledge.reranker import llm_rerank
from app.llm.factory import get_embedding_provider
from app.repositories.knowledge_repo import KnowledgeRepository

logger = logging.getLogger(__name__)

# Cosine floor below which we treat retrieval as "we don't actually know".
#
# nomic-embed-text does not return ~0 for unrelated text: measured against a
# real pricing/policy knowledge base, wholly off-topic queries ("airspeed
# velocity of an unladen swallow", "quantum chromodynamics") still scored
# 0.40-0.41, while an on-topic query scored 0.66. The previous 0.35 threshold
# sat *below* that noise floor, so the gate could never fire and the agent
# would answer confidently from irrelevant chunks. 0.50 sits clearly between
# the two. Re-measure this if EMBEDDING_MODEL changes — the floor is a
# property of the model, not of the corpus.
_LOW_CONFIDENCE_THRESHOLD = 0.50
_DEDUP_SIMILARITY = 0.92

# RRF damping. k=60 is the value from the original Cormack et al. paper and is
# the usual default: large enough that the top few ranks are not overwhelmingly
# weighted, small enough that deep results still fade out.
_RRF_K = 60

# How much of the final ordering is relevance vs. novelty in the MMR pass.
# 0.7 keeps relevance dominant while still breaking up near-duplicate runs.
_MMR_LAMBDA = 0.7


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


def _rrf(rank: int | None) -> float:
    """Reciprocal rank contribution; 0 when the arm did not return the row."""
    if not rank:
        return 0.0
    return 1.0 / (_RRF_K + float(rank))


def _mmr(
    ranked: list[tuple[float, dict]],
    top_k: int,
    lambda_: float = _MMR_LAMBDA,
) -> list[tuple[float, dict]]:
    """Greedy Maximal Marginal Relevance over the fused candidates.

    Similarity between candidates is token-overlap rather than a second
    embedding round trip — retrieval must stay cheap, and near-duplicate
    passages overlap lexically almost by definition.
    """
    if len(ranked) <= 1:
        return ranked

    selected: list[tuple[float, dict]] = []
    remaining = list(ranked)

    while remaining and len(selected) < top_k:
        best_i, best_val = 0, None
        for i, (score, row) in enumerate(remaining):
            redundancy = max(
                (_token_overlap(row["content"], chosen["content"]) for _, chosen in selected),
                default=0.0,
            )
            value = lambda_ * score - (1.0 - lambda_) * redundancy
            if best_val is None or value > best_val:
                best_i, best_val = i, value
        selected.append(remaining.pop(best_i))

    return selected


class KnowledgeRetriever:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = KnowledgeRepository(session)

    async def retrieve(
        self, organization_id: uuid.UUID, agent_type: str, query: str, top_k: int = 5,
    ) -> tuple[list[RetrievedChunk], bool]:
        """Returns (chunks, low_confidence). low_confidence=True means the
        caller should ask a clarifying question rather than trust the answer."""
        settings = get_settings()

        try:
            embedder = get_embedding_provider()
            [query_embedding] = await embedder.embed([query])
        except Exception:
            # The embedding provider (e.g. Ollama) being unreachable is an
            # infrastructure failure, not a "we don't know the answer"
            # failure — but from the caller's perspective the safe response
            # is the same: no chunks, low confidence, let the agent fall
            # back to answering without retrieved context (or asking a
            # clarifying question) instead of a raw 500. This mirrors the
            # LLM-generation step's malformed-JSON fallback elsewhere in
            # the pipeline — degrade, don't crash.
            logger.warning(
                "rag_retrieve_embedding_provider_unreachable org=%s agent=%s",
                organization_id, agent_type, exc_info=True,
            )
            return [], True

        candidates = await self._repo.hybrid_search(
            organization_id, agent_type, query_embedding, query, top_k=top_k,
        )
        if not candidates:
            return [], True

        # ── stage 2 + 3: RRF fusion with an exact-term nudge ──
        fused: list[tuple[float, dict]] = []
        for row in candidates:
            rrf_score = _rrf(row.get("vector_rank")) + _rrf(row.get("keyword_rank"))
            exact_overlap = _token_overlap(query, row["content"])
            # RRF values are small (~0.016 at rank 1 per arm); scale to 0..1-ish
            # so the overlap bonus stays a nudge rather than the main signal.
            combined = (rrf_score * _RRF_K) + (0.15 * exact_overlap)
            fused.append((combined, row))

        fused.sort(key=lambda x: x[0], reverse=True)

        # ── stage 4: optional cross-encoder rerank ──
        if getattr(settings, "RAG_LLM_RERANK", False) and len(fused) > 1:
            head = fused[: getattr(settings, "RAG_RERANK_CANDIDATES", 12)]
            scores = await llm_rerank(
                self._session, organization_id, agent_type, query,
                [row["content"] for _, row in head],
            )
            if scores:
                # Blend rather than replace: the cross-encoder is more precise
                # but is a single sampled judgement, so retrieval evidence
                # still carries weight.
                rescored = [
                    ((0.65 * scores[i]) + (0.35 * min(head[i][0], 1.0)), head[i][1])
                    for i in range(len(head))
                ]
                rescored.sort(key=lambda x: x[0], reverse=True)
                fused = rescored + fused[len(head):]

        # ── dedup near-identical chunks (keep the highest-scored copy) ──
        seen_normalized: list[str] = []
        unique: list[tuple[float, dict]] = []
        for score, row in fused:
            norm = _normalize(row["content"])
            if any(_token_overlap(norm, s) >= _DEDUP_SIMILARITY for s in seen_normalized):
                continue
            seen_normalized.append(norm)
            unique.append((score, row))

        # ── stage 5: MMR diversification over a wider pool than we return ──
        diversified = _mmr(unique[: max(top_k * 3, 12)], top_k)

        results = [
            RetrievedChunk(
                id=str(row["id"]),
                knowledge_source_id=str(row["knowledge_source_id"]),
                content=row["content"],
                metadata=row["metadata"] or {},
                score=round(score, 4),
            )
            for score, row in diversified[:top_k]
        ]

        # ── stage 6: confidence gate ──
        # Gate on raw cosine similarity, NOT the fused score. RRF is a ranking
        # signal: its magnitude reflects position within this query's own
        # candidate list, so even a poor match scores ~0.98 simply by being
        # rank 1 of whatever was returned. Cosine is an absolute measure of
        # how close the text actually is, which is what "do we know enough to
        # answer?" needs. Using the fused score here silently disabled the
        # gate and would have let the agent answer from weak evidence.
        best_vector = max((float(row.get("vector_score") or 0) for _, row in diversified), default=0.0)
        low_confidence = not results or best_vector < _LOW_CONFIDENCE_THRESHOLD
        logger.debug(
            "rag_retrieve org=%s agent=%s candidates=%d returned=%d fused_top=%.3f "
            "best_cosine=%.3f low_conf=%s",
            organization_id, agent_type, len(candidates), len(results),
            results[0].score if results else 0.0, best_vector, low_confidence,
        )
        return results, low_confidence

    @staticmethod
    def format_context(chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return "(no relevant knowledge found)"
        parts = []
        for i, c in enumerate(chunks, start=1):
            loc = (
                (c.metadata.get("page") and f"p.{c.metadata['page']}")
                or c.metadata.get("section")
                or c.metadata.get("heading")
                or ""
            )
            parts.append(f"[{i}]{f' ({loc})' if loc else ''} {c.content}")
        return "\n\n".join(parts)
