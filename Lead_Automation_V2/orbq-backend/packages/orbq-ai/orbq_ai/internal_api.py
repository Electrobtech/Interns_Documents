"""Internal API — the ONLY surface this service exposes.

Never routed at the gateway. The three public agent endpoints live in
orbq-ai-agents; this service is reachable only from inside the cluster, so a
marketing capability cannot become a public endpoint by accident (§9.3).
"""
from __future__ import annotations

import time

import structlog
from fastapi import APIRouter, Request

from orbq_contracts.capability import (
    CapabilityContext,
    CapabilityManifest,
    CapabilityResult,
)
from orbq_core.errors import NotFoundError
from orbq_core.tenancy import current_tenant

router = APIRouter(prefix="/internal", tags=["internal"])
log = structlog.get_logger()


@router.get("/capabilities", response_model=list[CapabilityManifest])
async def list_capabilities(request: Request) -> list[CapabilityManifest]:
    """Capability manifest, polled by the orchestrator at startup and every 5m.

    Discovery rather than a hardcoded orchestrator list is what lets a new
    capability ship by deploying only this service.
    """
    return request.app.state.registry.manifests()


@router.post("/capabilities/{name}", response_model=CapabilityResult)
async def invoke_capability(
    name: str, ctx: CapabilityContext, request: Request
) -> CapabilityResult:
    """Run one capability.

    The tenant context arrives as a signed header verified by
    TenantIsolationMiddleware — the org_id in the body is never trusted on its
    own, or a compromised caller could read any tenant's data.
    """
    registry = request.app.state.registry
    capability = registry.get(name)
    if capability is None:
        raise NotFoundError(f"Capability '{name}' is not registered in this workspace")

    tenant = current_tenant()
    if ctx.org_id != tenant.org_id:
        # The body disagreeing with the signed header means either a bug or an
        # attempt to cross tenants. Fail rather than pick one.
        from orbq_core.errors import ForbiddenError

        raise ForbiddenError("Capability context org_id does not match authenticated tenant")

    started = time.perf_counter()
    log.info("capability_invoked", capability=name, execution_id=str(ctx.execution_id))

    try:
        result = await capability.run(ctx)
    except Exception as exc:  # noqa: BLE001
        # Return a failed result rather than a 500: the orchestrator marks the
        # plan `partial` and still serves the user whatever else succeeded
        # (§10.7). A 500 here would lose the other capabilities' work.
        log.exception("capability_error", capability=name)
        return CapabilityResult(
            capability=name,
            output={},
            confidence=0.0,
            error=str(exc)[:500],
            duration_ms=int((time.perf_counter() - started) * 1000),
        )

    log.info(
        "capability_completed",
        capability=name,
        confidence=result.confidence,
        duration_ms=result.duration_ms,
        degraded=result.degraded,
    )
    return result
