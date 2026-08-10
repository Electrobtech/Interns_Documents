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
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import ConflictError, NotFoundError
from orbq_core.tenancy import current_tenant

from ...governance.approvals import ApprovalService
from ...models.marketing import ContentDoc, ContentVersion, Template
from ...schemas.marketing_extras import (
    ContentCreate,
    ContentOut,
    ContentSubmitApproval,
    ContentUpdate,
    ContentVersionOut,
    TemplateCreate,
    TemplateOut,
    TemplateUpdate,
)

router = APIRouter(prefix="/ai-agents/marketing", tags=["marketing-content"])


# ─── Content ─────────────────────────────────────────────────────────────

@router.get("/content", response_model=list[ContentOut])
async def list_content(
    content_type: str | None = Query(default=None),
    is_template: bool | None = Query(default=None),
    has_unverified_claims: bool | None = Query(default=None),
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
    if has_unverified_claims is not None:
        # "Unverified" means flagged-but-not-signed-off, so the comparison is
        # against the verified count, not merely whether claims exist.
        outstanding = func.jsonb_array_length(
            ContentDoc.claims_requiring_verification
        ) > func.jsonb_array_length(ContentDoc.claims_verified)
        stmt = stmt.where(outstanding if has_unverified_claims else ~outstanding)
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

    changes = body.model_dump(exclude_unset=True)
    change_note = changes.pop("change_note", None)

    # Snapshot the version being replaced, in the same transaction as the
    # increment. The counter and the history cannot disagree because they are
    # written together or not at all.
    substantive = {"title", "body", "variants"} & body.model_fields_set
    if substantive:
        db.add(
            ContentVersion(
                org_id=ctx.org_id, created_by=ctx.user_id,
                content_id=c.id, version=c.version,
                title=c.title, body=c.body, variants=c.variants,
                change_note=change_note,
            )
        )

    for field, value in changes.items():
        setattr(c, field, value)
    c.updated_by = ctx.user_id

    # Editing the body can invalidate a prior claim sign-off — a verified claim
    # may no longer appear in the text, or may have been reworded. Rather than
    # guess which survived, clear the sign-offs and make a human re-confirm.
    if "body" in body.model_fields_set and "claims_verified" not in body.model_fields_set:
        c.claims_verified = []

    if substantive:
        c.version += 1

    await db.flush()
    return ContentOut.model_validate(c)


@router.get("/content/{content_id}/versions", response_model=list[ContentVersionOut])
async def list_content_versions(
    content_id: uuid.UUID, db: AsyncSession = Depends(get_session)
) -> list[ContentVersionOut]:
    ctx = current_tenant()
    await _get_content(db, content_id)
    rows = (
        await db.execute(
            select(ContentVersion)
            .where(ContentVersion.org_id == ctx.org_id, ContentVersion.content_id == content_id)
            .order_by(ContentVersion.version.desc())
        )
    ).scalars().all()
    return [ContentVersionOut.model_validate(v) for v in rows]


@router.post("/content/{content_id}/submit", response_model=ContentOut)
async def submit_content_for_approval(
    content_id: uuid.UUID,
    body: ContentSubmitApproval,
    db: AsyncSession = Depends(get_session),
) -> ContentOut:
    """Routes publication through the governance engine.

    `content.publish` sits on the auto-approval denylist, so this can never be
    machine-approved regardless of confidence. Until this existed, `approval_id`
    was an unused column and nothing stopped ungrounded copy reaching a
    customer — in a system whose whole premise is the opposite.
    """
    ctx = current_tenant()
    c = await _get_content(db, content_id)

    if c.approval_id:
        raise ConflictError("This content has already been submitted for approval.")

    # Unverified claims block submission. The claims exist precisely because the
    # generator could not ground them; approving on top of that would make the
    # human check ceremonial.
    total_claims = len(c.claims_requiring_verification or [])
    verified = set(c.claims_verified or [])
    outstanding = [i for i in range(total_claims) if i not in verified]
    if outstanding:
        raise ConflictError(
            f"{len(outstanding)} of {total_claims} flagged claims are still "
            "unverified. Verify or remove them before submitting for publish."
        )

    service = ApprovalService(db)
    request = await service.create_from_proposal(
        proposal={
            "action_type": "content.publish",
            "summary": body.summary or f"Publish content: {c.title}",
            "payload": {
                "content_id": str(c.id), "title": c.title,
                "content_type": c.content_type, "platform": c.platform,
                "body": c.body, "version": c.version,
            },
            "reversible": True,
        },
        workspace="marketing",
        # Traces back to the agent run that drafted this, when there was one.
        execution_id=c.ai_execution_id,
        confidence=float(c.ai_confidence) if c.ai_confidence is not None else None,
        origin_service="orbq-ai-agents",
    )

    c.approval_id = request.id
    c.updated_by = ctx.user_id
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


@router.get("/templates/{template_id}", response_model=TemplateOut)
async def get_template(template_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> TemplateOut:
    return TemplateOut.model_validate(await _get_template(db, template_id))


@router.put("/templates/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID, body: TemplateUpdate, db: AsyncSession = Depends(get_session)
) -> TemplateOut:
    """Templates were create-once-then-delete-and-recreate, which threw away
    the row's id and usage count on every wording tweak."""
    ctx = current_tenant()
    t = await _get_template(db, template_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    t.updated_by = ctx.user_id
    await db.flush()
    return TemplateOut.model_validate(t)


async def _get_template(db: AsyncSession, template_id: uuid.UUID) -> Template:
    ctx = current_tenant()
    stmt = select(Template).where(
        Template.id == template_id, Template.org_id == ctx.org_id, Template.deleted_at.is_(None)
    )
    t = (await db.execute(stmt)).scalar_one_or_none()
    if t is None:
        raise NotFoundError(f"Template {template_id} not found")
    return t


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
