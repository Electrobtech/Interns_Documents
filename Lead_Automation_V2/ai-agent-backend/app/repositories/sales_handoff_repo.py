"""Real campaign -> lead -> order joins for the Sales Handoff feature. This
is the one part of the Marketing Agent expansion whose numbers are computed
in SQL, not reasoned by an LLM — the agent only narrates what this query
returns. Reads the same Postgres instance the Node campaign-service/
contact-service write to directly (the existing cross-service-read
convention already used throughout this codebase)."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _json_safe(row: dict) -> dict:
    """asyncpg returns Decimal for NUMERIC and datetime for timestamptz —
    neither is JSON-serializable as-is, and this data gets stored in a JSONB
    column (handoff_requests.agent_output) and returned in an API response."""
    out = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            out[k] = float(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, uuid.UUID):
            out[k] = str(v)
        else:
            out[k] = v
    return out


class SalesHandoffRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def campaign_conversion_summary(
        self, organization_id: uuid.UUID, campaign_id: uuid.UUID | None, limit: int = 10,
    ) -> list[dict]:
        rows = (await self._session.execute(
            text("""
                SELECT c.id, c.name, c.channel_type, c.status, c.created_at,
                       COUNT(DISTINCT ca.contact_id) AS audience_count,
                       COUNT(DISTINCT l.id) AS lead_count,
                       COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('paid', 'completed')) AS converted_count,
                       COALESCE(SUM(o.amount) FILTER (WHERE o.status IN ('paid', 'completed')), 0) AS converted_revenue
                  FROM campaigns c
                  LEFT JOIN campaign_audiences ca ON ca.campaign_id = c.id
                  LEFT JOIN leads l ON l.contact_id = ca.contact_id AND l.organization_id = c.organization_id
                  LEFT JOIN ecommerce_orders o ON o.contact_id = ca.contact_id AND o.organization_id = c.organization_id
                 WHERE c.organization_id = :org_id
                   AND (CAST(:campaign_id AS uuid) IS NULL OR c.id = CAST(:campaign_id AS uuid))
                 GROUP BY c.id, c.name, c.channel_type, c.status, c.created_at
                 ORDER BY c.created_at DESC
                 LIMIT :limit
            """),
            {"org_id": str(organization_id), "campaign_id": str(campaign_id) if campaign_id else None, "limit": limit},
        )).mappings().all()
        return [_json_safe(dict(r)) for r in rows]
