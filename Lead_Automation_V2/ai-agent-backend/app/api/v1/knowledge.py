"""Knowledge Base API — document upload, multi-file batch ingest, list,
re-index, delete, and web/note ingestion.

Supported source types: pdf, docx, txt, csv, md, note, web
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser, get_current_user
from app.database.tenant_scope import get_scoped_session
from app.knowledge.loaders import SUPPORTED_EXTENSIONS
from app.repositories.knowledge_repo import KnowledgeRepository
from app.schemas.knowledge import KnowledgeSourceOut
from app.services.audit_service import log_audit
from app.services.knowledge_service import KnowledgeService

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_EXT_TO_TYPE: dict[str, str] = {**SUPPORTED_EXTENSIONS}


def _source_type_from_filename(filename: str | None) -> str | None:
    if not filename:
        return None
    ext = filename.rsplit(".", 1)[-1].lower()
    return _EXT_TO_TYPE.get(ext)


# ---------------------------------------------------------------------------
# Single-file upload
# ---------------------------------------------------------------------------

@router.post("/knowledge/upload", response_model=KnowledgeSourceOut)
async def upload_knowledge(
    agent_type: str = Form(...),
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_scoped_session),
) -> KnowledgeSourceOut:
    source_type = _source_type_from_filename(file.filename)
    if not source_type:
        ext = (file.filename or "").rsplit(".", 1)[-1].lower()
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Supported: {', '.join(_EXT_TO_TYPE)}",
        )

    data = await file.read()
    organization_id = uuid.UUID(user.organization_id)
    source_id = await KnowledgeService(session).ingest(
        organization_id, agent_type, file.filename or "upload", source_type, data
    )
    await log_audit(
        session, organization_id, user.user_id, "ai_agents.knowledge.upload",
        {"name": file.filename, "agent_type": agent_type},
    )
    await session.commit()
    sources = await KnowledgeRepository(session).list_sources(organization_id, agent_type)
    match = next((s for s in sources if s.id == source_id), None)
    if not match:
        raise HTTPException(status_code=500, detail="Upload failed unexpectedly")
    return KnowledgeSourceOut.model_validate(match)


# ---------------------------------------------------------------------------
# Multi-file batch upload
# ---------------------------------------------------------------------------

class BatchIngestResult(BaseModel):
    ingested: list[KnowledgeSourceOut]
    failed: list[dict]


@router.post("/knowledge/upload/batch", response_model=BatchIngestResult)
async def batch_upload_knowledge(
    agent_type: str = Form(...),
    files: list[UploadFile] = File(...),
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_scoped_session),
) -> BatchIngestResult:
    """Ingest multiple files in a single request. Each file is processed
    independently — a failure on one does not abort the others."""
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required.")

    organization_id = uuid.UUID(user.organization_id)
    svc = KnowledgeService(session)
    repo = KnowledgeRepository(session)
    ingested: list[KnowledgeSourceOut] = []
    failed: list[dict] = []

    for upload in files:
        source_type = _source_type_from_filename(upload.filename)
        if not source_type:
            ext = (upload.filename or "").rsplit(".", 1)[-1].lower()
            failed.append({"filename": upload.filename, "error": f"Unsupported file type: .{ext}"})
            continue
        try:
            data = await upload.read()
            source_id = await svc.ingest(
                organization_id, agent_type, upload.filename or "upload", source_type, data
            )
            sources = await repo.list_sources(organization_id, agent_type)
            match = next((s for s in sources if s.id == source_id), None)
            if match:
                ingested.append(KnowledgeSourceOut.model_validate(match))
        except Exception as exc:
            failed.append({"filename": upload.filename, "error": str(exc)[:256]})

    await log_audit(
        session, organization_id, user.user_id, "ai_agents.knowledge.batch_upload",
        {"agent_type": agent_type, "count": len(ingested), "failed": len(failed)},
    )
    await session.commit()
    return BatchIngestResult(ingested=ingested, failed=failed)


# ---------------------------------------------------------------------------
# Web URL ingestion
# ---------------------------------------------------------------------------

class WebIngestIn(BaseModel):
    agent_type: str
    url: HttpUrl
    name: str | None = None


@router.post("/knowledge/ingest/web", response_model=KnowledgeSourceOut)
async def ingest_web(
    body: WebIngestIn,
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_scoped_session),
) -> KnowledgeSourceOut:
    """Fetch a web page and ingest its text content into the knowledge base."""
    organization_id = uuid.UUID(user.organization_id)
    url_str = str(body.url)
    name = body.name or url_str[:120]
    # Encode URL as bytes so the loader receives the same bytes interface.
    source_id = await KnowledgeService(session).ingest(
        organization_id, body.agent_type, name, "web", url_str.encode()
    )
    await log_audit(
        session, organization_id, user.user_id, "ai_agents.knowledge.ingest_web",
        {"url": url_str, "agent_type": body.agent_type},
    )
    await session.commit()
    sources = await KnowledgeRepository(session).list_sources(organization_id, body.agent_type)
    match = next((s for s in sources if s.id == source_id), None)
    if not match:
        raise HTTPException(status_code=500, detail="Web ingestion failed unexpectedly")
    return KnowledgeSourceOut.model_validate(match)


# ---------------------------------------------------------------------------
# Note ingestion (short freeform text, no file upload)
# ---------------------------------------------------------------------------

class NoteIngestIn(BaseModel):
    agent_type: str
    name: str
    content: str


@router.post("/knowledge/ingest/note", response_model=KnowledgeSourceOut)
async def ingest_note(
    body: NoteIngestIn,
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_scoped_session),
) -> KnowledgeSourceOut:
    """Ingest a freeform text note directly (no file needed)."""
    organization_id = uuid.UUID(user.organization_id)
    source_id = await KnowledgeService(session).ingest(
        organization_id, body.agent_type, body.name, "note", body.content.encode("utf-8")
    )
    await log_audit(
        session, organization_id, user.user_id, "ai_agents.knowledge.ingest_note",
        {"name": body.name, "agent_type": body.agent_type},
    )
    await session.commit()
    sources = await KnowledgeRepository(session).list_sources(organization_id, body.agent_type)
    match = next((s for s in sources if s.id == source_id), None)
    if not match:
        raise HTTPException(status_code=500, detail="Note ingestion failed unexpectedly")
    return KnowledgeSourceOut.model_validate(match)


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("/knowledge", response_model=list[KnowledgeSourceOut])
async def list_knowledge(
    agent_type: str | None = None,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_scoped_session),
) -> list[KnowledgeSourceOut]:
    organization_id = uuid.UUID(user.organization_id)
    sources = await KnowledgeRepository(session).list_sources(organization_id, agent_type)
    return [KnowledgeSourceOut.model_validate(s) for s in sources]


# ---------------------------------------------------------------------------
# Re-index (versioned update)
# ---------------------------------------------------------------------------

@router.post("/knowledge/{source_id}/reindex", response_model=KnowledgeSourceOut)
async def reindex_knowledge(
    source_id: uuid.UUID,
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_scoped_session),
) -> KnowledgeSourceOut:
    source_type = _source_type_from_filename(file.filename)
    if not source_type:
        ext = (file.filename or "").rsplit(".", 1)[-1].lower()
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    organization_id = uuid.UUID(user.organization_id)
    repo = KnowledgeRepository(session)
    sources = await repo.list_sources(organization_id)
    match = next((s for s in sources if s.id == source_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    data = await file.read()
    await KnowledgeService(session).reindex(
        organization_id, match.agent_type, source_id, source_type, data
    )
    await log_audit(
        session, organization_id, user.user_id, "ai_agents.knowledge.reindex",
        {"source_id": str(source_id)},
    )
    await session.commit()
    sources = await repo.list_sources(organization_id)
    match = next((s for s in sources if s.id == source_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Knowledge source not found after reindex")
    return KnowledgeSourceOut.model_validate(match)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/knowledge/{source_id}")
async def delete_knowledge(
    source_id: uuid.UUID,
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_scoped_session),
) -> dict:
    organization_id = uuid.UUID(user.organization_id)
    await KnowledgeRepository(session).delete_source(organization_id, source_id)
    await log_audit(
        session, organization_id, user.user_id, "ai_agents.knowledge.delete",
        {"id": str(source_id)},
    )
    await session.commit()
    return {"ok": True}
