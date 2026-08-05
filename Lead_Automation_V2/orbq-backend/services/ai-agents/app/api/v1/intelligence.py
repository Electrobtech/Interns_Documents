"""SEO, AEO, and Competitor Intelligence persistence.

/ai-agents/marketing/{seo/projects, seo/keywords, aeo/projects, competitors}

The pattern across all three: a capability run (seo / aeo / competitor_intel)
produces a result the marketer may want to keep. These endpoints are the
"save" half of that — nothing here calls an LLM itself. `data_source` and
`ai_execution_id` fields exist specifically so the UI can show whether a
number is measured, AI-inferred, or manually entered — carrying forward the
same honesty discipline the capabilities themselves already enforce.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import NotFoundError
from orbq_core.tenancy import current_tenant

from ...models.marketing import (
    AEOProject,
    Competitor,
    CompetitorSnapshot,
    SEOKeyword,
    SEOProject,
)
from ...schemas.marketing_extras import (
    AEOProjectCreate,
    AEOProjectOut,
    CompetitorCreate,
    CompetitorOut,
    CompetitorSnapshotCreate,
    CompetitorSnapshotOut,
    SEOKeywordCreate,
    SEOKeywordOut,
    SEOProjectCreate,
    SEOProjectOut,
)

router = APIRouter(prefix="/ai-agents/marketing", tags=["marketing-intelligence"])


# ─── SEO ─────────────────────────────────────────────────────────────────

@router.get("/seo/projects", response_model=list[SEOProjectOut])
async def list_seo_projects(db: AsyncSession = Depends(get_session)) -> list[SEOProjectOut]:
    ctx = current_tenant()
    rows = (
        await db.execute(
            select(SEOProject)
            .where(SEOProject.org_id == ctx.org_id, SEOProject.deleted_at.is_(None))
            .order_by(SEOProject.created_at.desc())
        )
    ).scalars().all()

    counts: dict[uuid.UUID, int] = {}
    if rows:
        counts = dict(
            (await db.execute(
                select(SEOKeyword.project_id, func.count())
                .where(SEOKeyword.project_id.in_([p.id for p in rows]))
                .group_by(SEOKeyword.project_id)
            )).all()
        )
    return [_seo_project_out(p, keyword_count=counts.get(p.id, 0)) for p in rows]


@router.post("/seo/projects", response_model=SEOProjectOut, status_code=201)
async def create_seo_project(body: SEOProjectCreate, db: AsyncSession = Depends(get_session)) -> SEOProjectOut:
    ctx = current_tenant()
    p = SEOProject(org_id=ctx.org_id, created_by=ctx.user_id, name=body.name,
                    domain=body.domain, target_keywords=body.target_keywords)
    db.add(p)
    await db.flush()
    return _seo_project_out(p, keyword_count=0)


def _seo_project_out(p: SEOProject, *, keyword_count: int) -> SEOProjectOut:
    return SEOProjectOut(
        id=p.id, name=p.name, domain=p.domain, target_keywords=p.target_keywords,
        last_audit_at=p.last_audit_at, latest_score=p.latest_score,
        keyword_count=keyword_count, created_at=p.created_at,
    )


@router.get("/seo/projects/{project_id}/keywords", response_model=list[SEOKeywordOut])
async def list_seo_keywords(project_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> list[SEOKeywordOut]:
    ctx = current_tenant()
    await _get_seo_project(db, project_id)  # 404s if not visible to this org
    rows = (
        await db.execute(
            select(SEOKeyword)
            .where(SEOKeyword.org_id == ctx.org_id, SEOKeyword.project_id == project_id,
                   SEOKeyword.deleted_at.is_(None))
            .order_by(SEOKeyword.created_at.desc())
        )
    ).scalars().all()
    return [SEOKeywordOut.model_validate(k) for k in rows]


@router.post("/seo/projects/{project_id}/keywords", response_model=SEOKeywordOut, status_code=201)
async def add_seo_keyword(
    project_id: uuid.UUID, body: SEOKeywordCreate, db: AsyncSession = Depends(get_session)
) -> SEOKeywordOut:
    ctx = current_tenant()
    await _get_seo_project(db, project_id)
    k = SEOKeyword(
        org_id=ctx.org_id, created_by=ctx.user_id, project_id=project_id,
        term=body.term, intent=body.intent, priority=body.priority,
        rationale=body.rationale, data_source=body.data_source,
    )
    db.add(k)
    await db.flush()
    return SEOKeywordOut.model_validate(k)


async def _get_seo_project(db: AsyncSession, project_id: uuid.UUID) -> SEOProject:
    ctx = current_tenant()
    stmt = select(SEOProject).where(
        SEOProject.id == project_id, SEOProject.org_id == ctx.org_id, SEOProject.deleted_at.is_(None)
    )
    p = (await db.execute(stmt)).scalar_one_or_none()
    if p is None:
        raise NotFoundError(f"SEO project {project_id} not found")
    return p


# ─── AEO ─────────────────────────────────────────────────────────────────

@router.get("/aeo/projects", response_model=list[AEOProjectOut])
async def list_aeo_projects(db: AsyncSession = Depends(get_session)) -> list[AEOProjectOut]:
    ctx = current_tenant()
    rows = (
        await db.execute(
            select(AEOProject)
            .where(AEOProject.org_id == ctx.org_id, AEOProject.deleted_at.is_(None))
            .order_by(AEOProject.created_at.desc())
        )
    ).scalars().all()
    return [AEOProjectOut.model_validate(p) for p in rows]


@router.post("/aeo/projects", response_model=AEOProjectOut, status_code=201)
async def create_aeo_project(body: AEOProjectCreate, db: AsyncSession = Depends(get_session)) -> AEOProjectOut:
    ctx = current_tenant()
    p = AEOProject(
        org_id=ctx.org_id, created_by=ctx.user_id, name=body.name, target_url=body.target_url,
        answer_ready_summary=body.answer_ready_summary, structured_facts=body.structured_facts,
        question_variants=body.question_variants, schema_suggestions=body.schema_suggestions,
        weaknesses=body.weaknesses, visibility_estimate=body.visibility_estimate,
        ai_execution_id=body.ai_execution_id,
    )
    db.add(p)
    await db.flush()
    return AEOProjectOut.model_validate(p)


@router.delete("/aeo/projects/{project_id}", status_code=204, response_class=Response)
async def delete_aeo_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> Response:
    ctx = current_tenant()
    stmt = select(AEOProject).where(
        AEOProject.id == project_id, AEOProject.org_id == ctx.org_id, AEOProject.deleted_at.is_(None)
    )
    p = (await db.execute(stmt)).scalar_one_or_none()
    if p is None:
        raise NotFoundError(f"AEO project {project_id} not found")
    p.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return Response(status_code=204)


# ─── Competitors ─────────────────────────────────────────────────────────

@router.get("/competitors", response_model=list[CompetitorOut])
async def list_competitors(db: AsyncSession = Depends(get_session)) -> list[CompetitorOut]:
    ctx = current_tenant()
    rows = (
        await db.execute(
            select(Competitor)
            .where(Competitor.org_id == ctx.org_id, Competitor.deleted_at.is_(None))
            .order_by(Competitor.created_at.desc())
        )
    ).scalars().all()

    counts: dict[uuid.UUID, int] = {}
    if rows:
        counts = dict(
            (await db.execute(
                select(CompetitorSnapshot.competitor_id, func.count())
                .where(CompetitorSnapshot.competitor_id.in_([c.id for c in rows]))
                .group_by(CompetitorSnapshot.competitor_id)
            )).all()
        )
    return [_competitor_out(c, snapshot_count=counts.get(c.id, 0)) for c in rows]


@router.post("/competitors", response_model=CompetitorOut, status_code=201)
async def create_competitor(body: CompetitorCreate, db: AsyncSession = Depends(get_session)) -> CompetitorOut:
    ctx = current_tenant()
    c = Competitor(org_id=ctx.org_id, created_by=ctx.user_id, name=body.name, domain=body.domain,
                    positioning=body.positioning, target_segments=body.target_segments)
    db.add(c)
    await db.flush()
    return _competitor_out(c, snapshot_count=0)


def _competitor_out(c: Competitor, *, snapshot_count: int) -> CompetitorOut:
    return CompetitorOut(
        id=c.id, name=c.name, domain=c.domain, positioning=c.positioning,
        target_segments=c.target_segments, last_analyzed_at=c.last_analyzed_at,
        snapshot_count=snapshot_count, created_at=c.created_at,
    )


@router.get("/competitors/{competitor_id}/snapshots", response_model=list[CompetitorSnapshotOut])
async def list_snapshots(competitor_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> list[CompetitorSnapshotOut]:
    ctx = current_tenant()
    await _get_competitor(db, competitor_id)
    rows = (
        await db.execute(
            select(CompetitorSnapshot)
            .where(CompetitorSnapshot.org_id == ctx.org_id, CompetitorSnapshot.competitor_id == competitor_id,
                   CompetitorSnapshot.deleted_at.is_(None))
            .order_by(CompetitorSnapshot.created_at.desc())
        )
    ).scalars().all()
    return [CompetitorSnapshotOut.model_validate(s) for s in rows]


@router.post("/competitors/{competitor_id}/snapshots", response_model=CompetitorSnapshotOut, status_code=201)
async def add_snapshot(
    competitor_id: uuid.UUID, body: CompetitorSnapshotCreate, db: AsyncSession = Depends(get_session)
) -> CompetitorSnapshotOut:
    ctx = current_tenant()
    competitor = await _get_competitor(db, competitor_id)
    s = CompetitorSnapshot(
        org_id=ctx.org_id, created_by=ctx.user_id, competitor_id=competitor_id,
        strengths=body.strengths, weaknesses=body.weaknesses, pricing_notes=body.pricing_notes,
        own_swot=body.own_swot, differentiation_angles=body.differentiation_angles,
        unverified_claim_count=body.unverified_claim_count, data_gaps=body.data_gaps,
        confidence=body.confidence, ai_execution_id=body.ai_execution_id,
    )
    db.add(s)
    competitor.last_analyzed_at = datetime.now(timezone.utc)
    await db.flush()
    return CompetitorSnapshotOut.model_validate(s)


async def _get_competitor(db: AsyncSession, competitor_id: uuid.UUID) -> Competitor:
    ctx = current_tenant()
    stmt = select(Competitor).where(
        Competitor.id == competitor_id, Competitor.org_id == ctx.org_id, Competitor.deleted_at.is_(None)
    )
    c = (await db.execute(stmt)).scalar_one_or_none()
    if c is None:
        raise NotFoundError(f"Competitor {competitor_id} not found")
    return c
