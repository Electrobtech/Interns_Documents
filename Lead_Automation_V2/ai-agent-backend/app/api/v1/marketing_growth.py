"""Marketing Agent growth expansion — Answer Engine Optimization (AEO), Meta
anti-ban deliverability pre-flight, Click-to-WhatsApp ad packages, and the Cold
Lead Revival Radar. All grounded in uploaded knowledge via RAG; AEO/CTWA persist
saved artifacts, anti-ban/cold-revival are computed live."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.schemas.marketing_extras import (
    AeoIn, AeoOut, AeoSummary,
    AntiBanIn, AntiBanOut,
    ColdRevivalIn, ColdRevivalOut,
    CtwaIn, CtwaOut, CtwaSummary,
)
from app.services.audit_service import log_audit
from app.services.growth_service import (
    AeoService, AntiBanService, ColdRevivalService, CtwaService,
)

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


# ── AEO — Answer Engine Optimization ───────────────────────────────────────


@router.post("/marketing/aeo/optimize", response_model=AeoOut)
async def optimize_for_answer_engines(
    body: AeoIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> AeoOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await AeoService(session).optimize(organization_id, body.copy)
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.aeo", {"copy": body.copy[:200]})
    await session.commit()
    return result


@router.get("/marketing/aeo/optimizations", response_model=list[AeoSummary])
async def list_aeo_optimizations(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> list[AeoSummary]:
    organization_id = uuid.UUID(user.organization_id)
    rows = await AeoService(session).list_recent(organization_id)
    return [AeoSummary.model_validate(r) for r in rows]


# ── Meta Anti-Ban deliverability pre-flight ────────────────────────────────


@router.post("/marketing/anti-ban-check", response_model=AntiBanOut)
async def anti_ban_check(
    body: AntiBanIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> AntiBanOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await AntiBanService(session).check(
        organization_id, body.draft, body.channel, body.recent_sends_note,
    )
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.anti_ban", {"channel": body.channel})
    await session.commit()
    return result


# ── Click-to-WhatsApp ad package ────────────────────────────────────────────


@router.post("/marketing/ctwa/generate", response_model=CtwaOut)
async def generate_ctwa_ad(
    body: CtwaIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CtwaOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await CtwaService(session).generate(organization_id, body.offer_brief)
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.ctwa", {"offer": body.offer_brief[:200]})
    await session.commit()
    return result


@router.get("/marketing/ctwa/packages", response_model=list[CtwaSummary])
async def list_ctwa_packages(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> list[CtwaSummary]:
    organization_id = uuid.UUID(user.organization_id)
    rows = await CtwaService(session).list_recent(organization_id)
    return [CtwaSummary.model_validate(r) for r in rows]


# ── Cold Lead Revival Radar ─────────────────────────────────────────────────


@router.post("/marketing/cold-revival", response_model=ColdRevivalOut)
async def cold_lead_revival(
    body: ColdRevivalIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ColdRevivalOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await ColdRevivalService(session).scan(organization_id, body.dormant_days, body.note)
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.cold_revival", {"dormant_days": body.dormant_days})
    await session.commit()
    return result
