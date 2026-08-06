"""Ingestion orchestration (§11.4).

    upload → extract → chunk → embed → persist → activate → emit event

Runs on the `ingestion` Celery queue. The upload endpoint returns 202 with a
source id; this does the slow work. A 200-page PDF must never occupy a request
thread.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_ai.client import LLMClient
from orbq_core.tenancy import current_tenant

from .chunking import chunk_text, embeddable_text
from .loaders import extract
from ..models.knowledge import DEFAULT_EMBEDDING_MODEL, KnowledgeChunk, KnowledgeSource

log = structlog.get_logger()

EMBED_BATCH_SIZE = 16


class IngestionPipeline:
    def __init__(
        self,
        session: AsyncSession,
        llm: LLMClient,
        *,
        target_chars: int = 900,
        overlap_chars: int = 150,
        min_chars: int = 120,
    ) -> None:
        self.db = session
        self.llm = llm
        self.target = target_chars
        self.overlap = overlap_chars
        self.minimum = min_chars

    async def create_source(
        self, *, filename: str, workspace: str, byte_size: int, source_type: str
    ) -> KnowledgeSource:
        """Register the source as `pending` so the UI can show it immediately.

        Versioning (§11.3): if an active source with the same name exists, this
        becomes version n+1 and the old one is deactivated on success — not now,
        because a failed ingest must not leave the tenant with no active version.
        """
        ctx = current_tenant()

        existing = (
            await self.db.execute(
                select(KnowledgeSource).where(
                    KnowledgeSource.org_id == ctx.org_id,
                    KnowledgeSource.workspace == workspace,
                    KnowledgeSource.name == filename,
                    KnowledgeSource.is_active.is_(True),
                    KnowledgeSource.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        source = KnowledgeSource(
            org_id=ctx.org_id,
            created_by=ctx.user_id,
            workspace=workspace,
            name=filename,
            source_type=source_type,
            status="pending",
            byte_size=byte_size,
            version=(existing.version + 1) if existing else 1,
            # Not active until indexing succeeds, so retrieval never sees a
            # half-populated version.
            is_active=False,
            supersedes_id=existing.id if existing else None,
        )
        self.db.add(source)
        await self.db.flush()
        return source

    async def ingest(self, source_id: uuid.UUID, data: bytes, filename: str) -> int:
        """Extract → chunk → embed → persist. Returns the chunk count."""
        source = await self.db.get(KnowledgeSource, source_id)
        if source is None:
            raise ValueError(f"Knowledge source {source_id} not found")

        source.status = "processing"
        await self.db.flush()

        try:
            document = extract(data, filename=filename, source_type=source.source_type)
            chunks = chunk_text(
                document.text,
                target=self.target,
                overlap=self.overlap,
                minimum=self.minimum,
            )
            if not chunks:
                raise ValueError("Document produced no chunks")

            # Batch embeddings — one request per chunk would be dramatically
            # slower and hammer the provider's rate limit.
            vectors: list[list[float] | None] = []
            for start in range(0, len(chunks), EMBED_BATCH_SIZE):
                batch = chunks[start : start + EMBED_BATCH_SIZE]
                texts = [embeddable_text(c) for c in batch]
                try:
                    vectors.extend(await self.llm.embed(texts))
                except Exception as exc:  # noqa: BLE001
                    # Degrade to keyword-only for this batch rather than losing
                    # the document: knowledge_chunks tolerates a null embedding
                    # and hybrid search still finds it via ts_rank.
                    log.warning("embedding_batch_failed", error=str(exc), batch_start=start)
                    vectors.extend([None] * len(batch))

            ctx = current_tenant()
            for chunk, vector in zip(chunks, vectors, strict=True):
                self.db.add(
                    KnowledgeChunk(
                        org_id=ctx.org_id,
                        created_by=ctx.user_id,
                        knowledge_source_id=source.id,
                        workspace=source.workspace,
                        chunk_index=chunk.index,
                        content=chunk.content,
                        heading_path=chunk.heading_path,
                        embedding=vector,
                        embedding_model=DEFAULT_EMBEDDING_MODEL,
                        chunk_metadata={"chars": len(chunk.content)},
                    )
                )

            source.chunk_count = len(chunks)
            source.status = "ready"
            source.is_active = True
            source.source_metadata = document.metadata
            source.error_detail = None

            # Deactivate the superseded version only now that the new one is
            # complete and queryable.
            if source.supersedes_id:
                await self.db.execute(
                    update(KnowledgeSource)
                    .where(
                        KnowledgeSource.id == source.supersedes_id,
                        KnowledgeSource.org_id == ctx.org_id,
                    )
                    .values(is_active=False, updated_at=datetime.now(timezone.utc))
                )

            await self.db.flush()
            log.info(
                "ingestion_complete",
                source_id=str(source.id),
                chunks=len(chunks),
                embedded=sum(1 for v in vectors if v is not None),
            )
            return len(chunks)

        except Exception as exc:
            source.status = "failed"
            source.error_detail = str(exc)[:2000]
            await self.db.flush()
            log.exception("ingestion_failed", source_id=str(source_id))
            raise
