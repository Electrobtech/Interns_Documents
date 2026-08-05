"""Content Studio + Templates — /ai-agents/marketing/{content,templates}.

ContentDoc is where a `content_generator` capability run gets saved if the
marketer wants to keep it (drafted text otherwise lives only in the ephemeral
agent-execution response). Saving is a deliberate, separate action, not
automatic — a rejected draft shouldn't clutter the library.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import NotFoundError
from orbq_core.tenancy import current_tenant

from ...models.marketing import ContentDoc, Template
from ...schemas.marketing_extras import (
    ContentCreate,
    ContentOut,
    ContentUpdate,
    TemplateCreate,
    TemplateOut,
)

router = APIRouter(prefix="/ai-agents/marketing", tags=["marketing-content"])


# ─── Content ─────────────────────────────────────────────────────────────

@router.get("/content", response_model=list[ContentOut])
async def list_content(
    content_type: str | None = Query(default=None),
    is_template: bool | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=100, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[ContentOut]:
    ctx = current_tenant()
    stmt = (
        select(ContentDoc)
        .where(ContentDoc.org_id == ctx.org_id, ContentDoc.deleted_at.is_(None))
        .order_by(ContentDoc.created_at.desc())
        .limit(limit)
    )
    if content_type:
        stmt = stmt.where(ContentDoc.content_type == content_type)
    if is_template is not None:
        stmt = stmt.where(ContentDoc.is_template == is_template)
    if search:
        stmt = stmt.where(ContentDoc.title.ilike(f"%{search}%"))
    rows = (await db.execute(stmt)).scalars().all()
    return [ContentOut.model_validate(c) for c in rows]


@router.post("/content", response_model=ContentOut, status_code=201)
async def create_content(body: ContentCreate, db: AsyncSession = Depends(get_session)) -> ContentOut:
    ctx = current_tenant()
    c = ContentDoc(
        org_id=ctx.org_id, created_by=ctx.user_id,
        title=body.title, content_type=body.content_type, platform=body.platform,
        body=body.body, variants=body.variants, tone=body.tone, tags=body.tags,
        is_template=body.is_template,
        claims_requiring_verification=body.claims_requiring_verification,
        ai_generated=body.ai_execution_id is not None,
        ai_execution_id=body.ai_execution_id, ai_confidence=body.ai_confidence,
    )
    db.add(c)
    await db.flush()
    return ContentOut.model_validate(c)


@router.get("/content/{content_id}", response_model=ContentOut)
async def get_content(content_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> ContentOut:
    return ContentOut.model_validate(await _get_content(db, content_id))


@router.put("/content/{content_id}", response_model=ContentOut)
async def update_content(
    content_id: uuid.UUID, body: ContentUpdate, db: AsyncSession = Depends(get_session)
) -> ContentOut:
    ctx = current_tenant()
    c = await _get_content(db, content_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    c.updated_by = ctx.user_id
    c.version += 1
    await db.flush()
    return ContentOut.model_validate(c)


@router.delete("/content/{content_id}", status_code=204, response_class=Response)
async def delete_content(content_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> Response:
    ctx = current_tenant()
    c = await _get_content(db, content_id)
    c.deleted_at = datetime.now(timezone.utc)
    c.updated_by = ctx.user_id
    await db.flush()
    return Response(status_code=204)


async def _get_content(db: AsyncSession, content_id: uuid.UUID) -> ContentDoc:
    ctx = current_tenant()
    stmt = select(ContentDoc).where(
        ContentDoc.id == content_id, ContentDoc.org_id == ctx.org_id, ContentDoc.deleted_at.is_(None)
    )
    c = (await db.execute(stmt)).scalar_one_or_none()
    if c is None:
        raise NotFoundError(f"Content {content_id} not found")
    return c


# ─── Templates ───────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    template_type: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=100, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[TemplateOut]:
    ctx = current_tenant()
    stmt = (
        select(Template)
        .where(Template.org_id == ctx.org_id, Template.deleted_at.is_(None))
        .order_by(Template.created_at.desc())
        .limit(limit)
    )
    if template_type:
        stmt = stmt.where(Template.template_type == template_type)
    if channel:
        stmt = stmt.where(Template.channel == channel)
    if search:
        stmt = stmt.where(Template.name.ilike(f"%{search}%"))
    rows = (await db.execute(stmt)).scalars().all()
    return [TemplateOut.model_validate(t) for t in rows]


@router.post("/templates", response_model=TemplateOut, status_code=201)
async def create_template(body: TemplateCreate, db: AsyncSession = Depends(get_session)) -> TemplateOut:
    ctx = current_tenant()
    t = Template(
        org_id=ctx.org_id, created_by=ctx.user_id,
        name=body.name, template_type=body.template_type, channel=body.channel,
        subject=body.subject, body=body.body, variables=body.variables, tags=body.tags,
    )
    db.add(t)
    await db.flush()
    return TemplateOut.model_validate(t)


@router.delete("/templates/{template_id}", status_code=204, response_class=Response)
async def delete_template(template_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> Response:
    ctx = current_tenant()
    stmt = select(Template).where(
        Template.id == template_id, Template.org_id == ctx.org_id, Template.deleted_at.is_(None)
    )
    t = (await db.execute(stmt)).scalar_one_or_none()
    if t is None:
        raise NotFoundError(f"Template {template_id} not found")
    t.deleted_at = datetime.now(timezone.utc)
    t.updated_by = ctx.user_id
    await db.flush()
    return Response(status_code=204)
