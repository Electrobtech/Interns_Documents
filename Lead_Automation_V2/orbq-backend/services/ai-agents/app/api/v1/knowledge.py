"""Knowledge base management — Phase 6.

Upload returns 202 Accepted with a source id; indexing runs on the ingestion
worker. The frontend polls GET /ai-agents/knowledge while status is
pending/processing (see useKnowledgeSources).
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import NotFoundError, ValidationError
from orbq_core.security import PERM_AI_MANAGE
from orbq_core.tenancy import current_tenant

from ...deps import get_pipeline
from ...models.knowledge import KnowledgeChunk, KnowledgeSource
from ...rag.loaders import detect_source_type
from ...rag.pipeline import IngestionPipeline
from ...workers.tasks import ingest_document

router = APIRouter(tags=["knowledge"])

VALID_WORKSPACES = {"marketing", "sales", "support"}


@router.get("/ai-agents/knowledge")
async def list_sources(
    workspace: str = Query(...),
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    if workspace not in VALID_WORKSPACES:
        raise ValidationError(f"workspace must be one of {sorted(VALID_WORKSPACES)}")

    ctx = current_tenant()
    stmt = (
        select(KnowledgeSource)
        .where(
            KnowledgeSource.org_id == ctx.org_id,
            KnowledgeSource.workspace == workspace,
            KnowledgeSource.deleted_at.is_(None),
        )
        .order_by(KnowledgeSource.created_at.desc())
    )
    if not include_inactive:
        stmt = stmt.where(KnowledgeSource.is_active.is_(True))

    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "workspace": s.workspace,
            "source_type": s.source_type,
            "status": s.status,
            "chunk_count": s.chunk_count,
            "byte_size": s.byte_size,
            "version": s.version,
            "is_active": s.is_active,
            "error_detail": s.error_detail,
            "metadata": s.source_metadata,
            "created_at": s.created_at.isoformat(),
        }
        for s in rows
    ]


@router.post("/ai-agents/knowledge/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    workspace: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    pipeline: Annotated[IngestionPipeline, Depends(get_pipeline)],
) -> dict:
    """Accept a document and queue it for indexing.

    202, not 200: a 200-page PDF takes minutes to chunk and embed, and holding a
    request thread open for that is how a web tier falls over.
    """
    ctx = current_tenant()
    ctx.require_permission(PERM_AI_MANAGE)

    if workspace not in VALID_WORKSPACES:
        raise ValidationError(f"workspace must be one of {sorted(VALID_WORKSPACES)}")
    if not file.filename:
        raise ValidationError("A filename is required")

    source_type = detect_source_type(file.filename)  # raises on unsupported types
    data = await file.read()

    source = await pipeline.create_source(
        filename=file.filename,
        workspace=workspace,
        byte_size=len(data),
        source_type=source_type,
    )

    ingest_document.delay(
        source_id=str(source.id),
        org_id=str(ctx.org_id),
        user_id=str(ctx.user_id),
        filename=file.filename,
        payload=data,
    )

    return {
        "id": str(source.id),
        "name": source.name,
        "status": source.status,
        "version": source.version,
        "message": "Queued for indexing. Poll this endpoint for status.",
    }


@router.post("/ai-agents/knowledge/{source_id}/reindex", status_code=status.HTTP_202_ACCEPTED)
async def reindex_source(
    source_id: uuid.UUID,
    pipeline: Annotated[IngestionPipeline, Depends(get_pipeline)],
    file: Annotated[UploadFile | None, File()] = None,
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Re-chunk and re-embed, creating a new version.

    Supplying a file replaces the content; omitting it re-processes the same
    document (used after a chunking or embedding-model change).
    """
    ctx = current_tenant()
    ctx.require_permission(PERM_AI_MANAGE)

    source = (
        await db.execute(
            select(KnowledgeSource).where(
                KnowledgeSource.id == source_id,
                KnowledgeSource.org_id == ctx.org_id,
                KnowledgeSource.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if source is None:
        raise NotFoundError(f"Knowledge source {source_id} not found")

    if file is None:
        # Re-processing without the original bytes needs the raw text we stored
        # in MongoDB at ingest time. Until that path exists, be explicit rather
        # than silently doing nothing.
        raise ValidationError(
            "Re-indexing without a file requires the archived raw document, "
            "which is not yet wired up. Re-upload the file instead."
        )

    data = await file.read()
    new_source = await pipeline.create_source(
        filename=source.name,
        workspace=source.workspace,
        byte_size=len(data),
        source_type=detect_source_type(file.filename or source.name),
    )

    ingest_document.delay(
        source_id=str(new_source.id),
        org_id=str(ctx.org_id),
        user_id=str(ctx.user_id),
        filename=file.filename or source.name,
        payload=data,
    )

    return {
        "id": str(new_source.id),
        "supersedes": str(source.id),
        "version": new_source.version,
        "status": new_source.status,
    }


@router.delete(
    "/ai-agents/knowledge/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    # 204 must not declare a response body — FastAPI asserts this at import time.
    response_class=Response,
)
async def delete_source(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Soft delete (§16.3).

    Hard-deleting would break explainability retroactively: an execution trace
    citing this document must remain readable.
    """
    ctx = current_tenant()
    ctx.require_permission(PERM_AI_MANAGE)

    source = (
        await db.execute(
            select(KnowledgeSource).where(
                KnowledgeSource.id == source_id,
                KnowledgeSource.org_id == ctx.org_id,
                KnowledgeSource.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if source is None:
        raise NotFoundError(f"Knowledge source {source_id} not found")

    from datetime import datetime, timezone

    source.deleted_at = datetime.now(timezone.utc)
    source.updated_by = ctx.user_id
    source.is_active = False
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/ai-agents/knowledge/stats")
async def knowledge_stats(db: AsyncSession = Depends(get_session)) -> dict:
    """Corpus size per workspace — backs the "Knowledge Sources" dashboard tile."""
    ctx = current_tenant()

    stmt = (
        select(
            KnowledgeSource.workspace,
            func.count(KnowledgeSource.id).label("sources"),
            func.coalesce(func.sum(KnowledgeSource.chunk_count), 0).label("chunks"),
        )
        .where(
            KnowledgeSource.org_id == ctx.org_id,
            KnowledgeSource.deleted_at.is_(None),
            KnowledgeSource.is_active.is_(True),
        )
        .group_by(KnowledgeSource.workspace)
    )
    rows = (await db.execute(stmt)).all()

    embedded = (
        await db.execute(
            select(func.count(KnowledgeChunk.id)).where(
                KnowledgeChunk.org_id == ctx.org_id,
                KnowledgeChunk.deleted_at.is_(None),
                KnowledgeChunk.embedding.isnot(None),
            )
        )
    ).scalar_one()

    return {
        "by_workspace": {
            r.workspace: {"sources": r.sources, "chunks": int(r.chunks)} for r in rows
        },
        "total_sources": sum(r.sources for r in rows),
        "total_chunks": sum(int(r.chunks) for r in rows),
        # A gap here means hybrid search is running keyword-only for those
        # chunks — worth surfacing rather than hiding.
        "embedded_chunks": embedded,
    }
