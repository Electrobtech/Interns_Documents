"""Repository for ProviderUsageLog — write (non-blocking best-effort) and
read for the /providers/stats endpoint."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.provider_log import ProviderUsageLog


class ProviderLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(
        self,
        *,
        provider: str,
        model: str,
        operation: str = "generate",
        agent_type: str | None = None,
        organization_id: uuid.UUID | None = None,
        fallback_used: bool = False,
        latency_ms: int | None = None,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        status: str = "ok",
        error_message: str | None = None,
    ) -> None:
        """Fire-and-forget insert; caller must commit the session."""
        self._session.add(ProviderUsageLog(
            organization_id=organization_id,
            provider=provider,
            model=model,
            operation=operation,
            agent_type=agent_type,
            fallback_used=fallback_used,
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            status=status,
            error_message=error_message,
        ))

    async def stats(self, days: int = 7, organization_id: uuid.UUID | None = None) -> dict:
        """Aggregate stats for the /providers/stats endpoint."""
        base_filter = "created_at >= now() - (:days || ' days')::interval"
        org_filter = "AND organization_id = :org_id" if organization_id else ""
        params: dict = {"days": str(days)}
        if organization_id:
            params["org_id"] = str(organization_id)

        # Total calls + fallback count per provider
        rows = (await self._session.execute(
            text(f"""
                SELECT provider, operation,
                       COUNT(*) AS total_calls,
                       SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) AS fallback_count,
                       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count,
                       AVG(latency_ms) AS avg_latency_ms,
                       SUM(prompt_tokens) AS total_prompt_tokens,
                       SUM(completion_tokens) AS total_completion_tokens
                  FROM provider_usage_logs
                 WHERE {base_filter} {org_filter}
                 GROUP BY provider, operation
                 ORDER BY provider, operation
            """),
            params,
        )).mappings().all()

        by_provider: dict[str, dict] = {}
        for r in rows:
            p = r["provider"]
            if p not in by_provider:
                by_provider[p] = {"provider": p, "operations": []}
            by_provider[p]["operations"].append({
                "operation": r["operation"],
                "total_calls": int(r["total_calls"]),
                "fallback_count": int(r["fallback_count"] or 0),
                "error_count": int(r["error_count"] or 0),
                "avg_latency_ms": round(float(r["avg_latency_ms"] or 0), 1),
                "total_prompt_tokens": int(r["total_prompt_tokens"] or 0),
                "total_completion_tokens": int(r["total_completion_tokens"] or 0),
            })

        # Per-agent breakdown
        agent_rows = (await self._session.execute(
            text(f"""
                SELECT agent_type, provider, COUNT(*) AS calls,
                       SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) AS fallbacks
                  FROM provider_usage_logs
                 WHERE agent_type IS NOT NULL AND {base_filter} {org_filter}
                 GROUP BY agent_type, provider
                 ORDER BY agent_type, provider
            """),
            params,
        )).mappings().all()

        by_agent: dict[str, list] = {}
        for r in agent_rows:
            at = r["agent_type"]
            if at not in by_agent:
                by_agent[at] = []
            by_agent[at].append({
                "provider": r["provider"],
                "calls": int(r["calls"]),
                "fallbacks": int(r["fallbacks"] or 0),
            })

        return {
            "range_days": days,
            "by_provider": list(by_provider.values()),
            "by_agent": [{"agent_type": k, "providers": v} for k, v in by_agent.items()],
        }
