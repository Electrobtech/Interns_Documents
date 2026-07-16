"""Document upload -> extract -> chunk -> embed -> store. Every upload
supersedes prior chunks for that source (re-index on update), and bumps
`version` so version history is real, not decorative."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.knowledge.chunking import chunk_text
from app.knowledge.loaders import extract
from app.llm.factory import get_embedding_provider
from app.repositories.knowledge_repo import KnowledgeRepository

logger = logging.getLogger(__name__)


class KnowledgeService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = KnowledgeRepository(session)

    async def ingest(
        self, organization_id: uuid.UUID, agent_type: str, name: str, source_type: str, data: bytes,
    ) -> uuid.UUID:
        source = await self._repo.create_source(
            organization_id, agent_type, name, source_type, source_metadata={"size_bytes": len(data)}
        )
        await self._session.commit()

        try:
            pages = extract(source_type, data)
            all_chunks = []
            for page in pages:
                all_chunks.extend(chunk_text(page.text, page.metadata))

            if not all_chunks:
                await self._repo.mark_failed(source.id, "No extractable text found in document.")
                await self._session.commit()
                return source.id

            embedder = get_embedding_provider()
            texts = [c.text for c in all_chunks]
            embeddings = await embedder.embed(texts)

            for i, (chunk, embedding) in enumerate(zip(all_chunks, embeddings)):
                await self._repo.add_chunk(
                    organization_id, source.id, agent_type, i, chunk.text, embedding, chunk.metadata
                )

            await self._repo.mark_ready(source.id, len(all_chunks))
            await self._session.commit()
            logger.info("knowledge_ingested source_id=%s chunks=%d", source.id, len(all_chunks))
        except Exception as exc:
            logger.exception("knowledge_ingest_failed source_id=%s", source.id)
            await self._repo.mark_failed(source.id, str(exc)[:500])
            await self._session.commit()

        return source.id

    async def reindex(
        self, organization_id: uuid.UUID, agent_type: str, source_id: uuid.UUID, source_type: str, data: bytes,
    ) -> None:
        """Re-embed everything for this source (e.g. embedding model change or
        content update) — deletes old chunks, re-runs the full pipeline, bumps version."""
        from app.models.knowledge import KnowledgeSource

        source = await self._session.get(KnowledgeSource, source_id)
        if not source or source.organization_id != organization_id:
            raise ValueError("Knowledge source not found")

        await self._repo.delete_chunks_for_source(source_id)
        source.status = "processing"
        source.version += 1
        await self._session.commit()

        try:
            pages = extract(source_type, data)
            all_chunks = []
            for page in pages:
                all_chunks.extend(chunk_text(page.text, page.metadata))

            if not all_chunks:
                await self._repo.mark_failed(source_id, "No extractable text found in document.")
                await self._session.commit()
                return

            embedder = get_embedding_provider()
            embeddings = await embedder.embed([c.text for c in all_chunks])
            for i, (chunk, embedding) in enumerate(zip(all_chunks, embeddings)):
                await self._repo.add_chunk(organization_id, source_id, agent_type, i, chunk.text, embedding, chunk.metadata)

            await self._repo.mark_ready(source_id, len(all_chunks))
            await self._session.commit()
        except Exception as exc:
            logger.exception("knowledge_reindex_failed source_id=%s", source_id)
            await self._repo.mark_failed(source_id, str(exc)[:500])
            await self._session.commit()
