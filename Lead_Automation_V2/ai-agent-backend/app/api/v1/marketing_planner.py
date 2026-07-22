"""Content calendar / campaign planner — part of the Marketing Agent
expansion. A generated plan's items can be converted into a real campaign
row in campaign-service one at a time."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.schemas.marketing_extras import (
    CampaignPlanIn, CampaignPlanOut, CampaignPlanSummary, ConvertPlanItemIn,
)
from app.services.audit_service import log_audit
from app.services.campaign_planner_service import CampaignPlannerService

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/marketing/campaign-plan", response_model=CampaignPlanOut)
async def generate_campaign_plan(
    body: CampaignPlanIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CampaignPlanOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await CampaignPlannerService(session).generate(
        organization_id, body.name, body.goal, body.timeframe, body.channels, body.persona,
    )
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.campaign_plan", {"name": body.name, "goal": body.goal[:200]})
    await session.commit()
    return result


@router.get("/marketing/campaign-plans", response_model=list[CampaignPlanSummary])
async def list_campaign_plans(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> list[CampaignPlanSummary]:
    organization_id = uuid.UUID(user.organization_id)
    rows = await CampaignPlannerService(session).list_recent(organization_id)
    return [CampaignPlanSummary.model_validate(r) for r in rows]


@router.post("/marketing/campaign-plan/{plan_id}/items/{item_index}/convert")
async def convert_plan_item(
    plan_id: uuid.UUID,
    item_index: int,
    body: ConvertPlanItemIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    organization_id = uuid.UUID(user.organization_id)
    try:
        campaign = await CampaignPlannerService(session).convert_item(
            organization_id, plan_id, item_index, body.channel_type, body.message_body,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.convert_plan_item", {"plan_id": str(plan_id), "item_index": item_index})
    await session.commit()
    return campaign
