"""Provider stats API — usage logs, fallback rates, token consumption, and
latency per provider / per agent. Data comes from provider_usage_logs."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.tenant_scope import get_scoped_session
from app.llm.factory import get_llm_provider
from app.repositories.provider_log_repo import ProviderLogRepository

router = APIRouter()

_RANGE_TO_DAYS = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}


@router.get("/providers/stats")
async def provider_stats(
    range: str = Query(default="7d"),
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_scoped_session),
) -> dict:
    """Return aggregated LLM provider usage statistics.

    Includes:
    - total calls + fallback count per provider
    - per-operation breakdown (generate / embed)
    - per-agent breakdown
    - avg latency and token totals
    """
    days = _RANGE_TO_DAYS.get(range, 7)
    organization_id = uuid.UUID(user.organization_id)
    stats = await ProviderLogRepository(session).stats(days=days, organization_id=organization_id)
    stats["range"] = range

    # Also include live health status.
    provider = get_llm_provider()
    stats["provider_healthy"] = await provider.health_check()

    return stats
