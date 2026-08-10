"""ICP / buyer persona builder — part of the Marketing Agent expansion."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.tenant_scope import get_scoped_session
from app.schemas.marketing_extras import PersonaIn, PersonaOut, PersonaSummary
from app.services.audit_service import log_audit
from app.services.persona_service import PersonaService

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/marketing/personas", response_model=PersonaOut)
async def generate_persona(
    body: PersonaIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> PersonaOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await PersonaService(session).generate(organization_id, body.brief, body.name)
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.persona", {"brief": body.brief[:200]})
    await session.commit()
    return result


@router.get("/marketing/personas", response_model=list[PersonaSummary])
async def list_personas(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> list[PersonaSummary]:
    organization_id = uuid.UUID(user.organization_id)
    rows = await PersonaService(session).list_recent(organization_id)
    return [PersonaSummary.model_validate(r) for r in rows]


@router.delete("/marketing/personas/{persona_id}")
async def delete_persona(
    persona_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> dict:
    organization_id = uuid.UUID(user.organization_id)
    ok = await PersonaService(session).delete(organization_id, persona_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Persona not found")
    return {"ok": True}
