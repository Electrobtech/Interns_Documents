"""SEO keyword research + content briefs — part of the Marketing Agent
expansion. LLM-reasoned keyword suggestions, not real search-volume data
(no external SEO tool is integrated)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.schemas.marketing_extras import SeoBriefIn, SeoBriefOut, SeoBriefSummary
from app.services.audit_service import log_audit
from app.services.seo_service import SeoService

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/marketing/seo/brief", response_model=SeoBriefOut)
async def generate_seo_brief(
    body: SeoBriefIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> SeoBriefOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await SeoService(session).generate(organization_id, body.topic)
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.seo_brief", {"topic": body.topic[:200]})
    await session.commit()
    return result


@router.get("/marketing/seo/briefs", response_model=list[SeoBriefSummary])
async def list_seo_briefs(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> list[SeoBriefSummary]:
    organization_id = uuid.UUID(user.organization_id)
    rows = await SeoService(session).list_recent(organization_id)
    return [SeoBriefSummary.model_validate(r) for r in rows]
