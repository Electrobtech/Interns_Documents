"""Sales handoff — real campaign->lead->order conversion data, narrated
into a brief and written to the existing handoff_requests table so it shows
up in the platform's Handoff Queue like any other agent escalation."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.tenant_scope import get_scoped_session
from app.schemas.marketing_extras import SalesHandoffIn, SalesHandoffOut
from app.services.audit_service import log_audit
from app.services.sales_handoff_service import SalesHandoffService

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/marketing/sales-handoff", response_model=SalesHandoffOut)
async def generate_sales_handoff(
    body: SalesHandoffIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> SalesHandoffOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await SalesHandoffService(session).generate(organization_id, body.campaign_id, body.note)
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.sales_handoff", {"campaign_id": str(body.campaign_id) if body.campaign_id else None})
    await session.commit()
    return result
