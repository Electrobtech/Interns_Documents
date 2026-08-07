"""Health checks (§21.6).

The readiness distinction matters: `/health/ready` checks only *this* service's
own datastores, never its downstream services. A service that reports unready
because a dependency is down converts a partial outage into a total one —
dependency health belongs in circuit breakers and metrics, not readiness probes.
"""
from __future__ import annotations

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import text

from orbq_core.db.session import get_engine

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def live() -> dict:
    """Liveness: is the process up? Never touches dependencies — a DB blip must
    not restart every pod."""
    return {"status": "alive"}


@router.get("/health/ready")
async def ready(request: Request, response: Response) -> dict:
    checks: dict[str, str] = {}
    healthy = True

    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["postgres"] = f"error: {str(exc)[:120]}"
        healthy = False

    try:
        await request.app.state.redis.ping()
        checks["redis"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["redis"] = f"error: {str(exc)[:120]}"
        healthy = False

    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ready" if healthy else "not_ready", "checks": checks}


@router.get("/health/startup")
async def startup(request: Request) -> dict:
    """Startup: is the capability registry populated?

    Reported for visibility but never fails the probe — the agent tier coming up
    after this service is normal, and the refresh loop will catch it.
    """
    registry = getattr(request.app.state, "registry", None)
    return {
        "status": "started",
        "capabilities_discovered": registry.total if registry else 0,
        "workspaces": list(registry.all().keys()) if registry else [],
    }


@router.get("/health/llm")
async def llm_health(request: Request) -> dict:
    """Provider reachability. Separate from readiness on purpose: an LLM outage
    degrades answers (§10.7), it does not make the service unable to serve."""
    return await request.app.state.llm.health()
