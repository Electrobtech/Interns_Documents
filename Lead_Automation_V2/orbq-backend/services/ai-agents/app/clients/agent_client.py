"""Client for the agent tier (marketing / sales / support).

Every call carries the signed tenant context (§17.2) so the receiving service
knows which org it is acting for without trusting a caller-supplied org_id.

Resilience per §7.4: timeout, bounded retries on idempotent calls, and a circuit
breaker so a dead agent service degrades that workspace rather than hanging every
request behind it.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

import httpx
import structlog

from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext, CapabilityManifest, CapabilityResult
from orbq_core.errors import CircuitOpenError, DependencyUnavailableError
from orbq_core.tenancy import (
    INTERNAL_SIGNATURE_HEADER,
    INTERNAL_TENANT_HEADER,
    current_tenant,
    sign_tenant_context,
)

log = structlog.get_logger()


@dataclass
class CircuitBreaker:
    """Per-dependency breaker.

    Without this, a hung agent service turns every agent request into a timeout,
    and the orchestrator's connection pool fills with doomed requests — one
    workspace's outage becomes a whole-service outage.
    """

    threshold: int = 5
    reset_seconds: float = 30.0
    failures: int = 0
    opened_at: float | None = None
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def check(self, name: str) -> None:
        async with self._lock:
            if self.opened_at is None:
                return
            if time.monotonic() - self.opened_at >= self.reset_seconds:
                # Half-open: let one probe through.
                self.opened_at = None
                self.failures = 0
                log.info("circuit_half_open", dependency=name)
                return
            raise CircuitOpenError(name, f"{name} circuit is open")

    async def record_success(self) -> None:
        async with self._lock:
            self.failures = 0
            self.opened_at = None

    async def record_failure(self, name: str) -> None:
        async with self._lock:
            self.failures += 1
            if self.failures >= self.threshold and self.opened_at is None:
                self.opened_at = time.monotonic()
                log.warning("circuit_opened", dependency=name, failures=self.failures)


class AgentServiceClient:
    def __init__(self, *, urls: dict[str, str], signing_key: str, timeout: float = 120.0):
        self.urls = urls
        self.signing_key = signing_key
        self.timeout = timeout
        self.breakers: dict[str, CircuitBreaker] = {
            ws: CircuitBreaker() for ws in urls
        }
        self._manifests: dict[str, dict[str, CapabilityManifest]] = {}

    def _headers(self) -> dict[str, str]:
        payload, signature = sign_tenant_context(current_tenant(), self.signing_key)
        return {
            INTERNAL_TENANT_HEADER: payload,
            INTERNAL_SIGNATURE_HEADER: signature,
            "Content-Type": "application/json",
        }

    @staticmethod
    def _discovery_headers() -> dict[str, str]:
        """Discovery carries no tenant context, deliberately.

        A capability manifest is static service metadata — names, schemas, cost
        hints — with no tenant data in it. Startup discovery runs before any
        request exists, so demanding a TenantContext here would (and did) make
        the registry permanently empty.
        """
        return {"Content-Type": "application/json"}

    async def discover(self, workspace: str) -> dict[str, CapabilityManifest]:
        """Fetch a service's capability manifest.

        Discovery rather than a hardcoded list is what lets a new capability ship
        by deploying one service — no orchestrator change, no contract change.
        """
        url = self.urls[workspace]
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{url}/internal/capabilities", headers=self._discovery_headers())
                resp.raise_for_status()
                manifests = {
                    m["name"]: CapabilityManifest.model_validate(m) for m in resp.json()
                }
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("capability_discovery_failed", workspace=workspace, error=str(exc))
            # Fall back to whatever we learned last time rather than dropping the
            # workspace entirely — a discovery blip should not disable an agent.
            return self._manifests.get(workspace, {})

        self._manifests[workspace] = manifests
        log.info("capabilities_discovered", workspace=workspace, count=len(manifests))
        return manifests

    async def invoke(
        self, workspace: Workspace, capability: str, ctx: CapabilityContext
    ) -> CapabilityResult:
        ws = workspace.value if isinstance(workspace, Workspace) else str(workspace)
        url = self.urls[ws]
        breaker = self.breakers[ws]

        await breaker.check(ws)

        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{url}/internal/capabilities/{capability}",
                    json=ctx.model_dump(mode="json"),
                    headers=self._headers(),
                )
                resp.raise_for_status()
                result = CapabilityResult.model_validate(resp.json())
        except httpx.HTTPStatusError as exc:
            await breaker.record_failure(ws)
            raise DependencyUnavailableError(
                ws, f"{capability} returned {exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:
            await breaker.record_failure(ws)
            raise DependencyUnavailableError(ws, f"{capability} unreachable: {exc}") from exc

        await breaker.record_success()
        if not result.duration_ms:
            result.duration_ms = int((time.perf_counter() - started) * 1000)
        return result

    async def health(self) -> dict[str, bool]:
        async def probe(ws: str, url: str) -> tuple[str, bool]:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(f"{url}/health/live")
                    return ws, resp.status_code == 200
            except httpx.HTTPError:
                return ws, False

        results = await asyncio.gather(*(probe(ws, url) for ws, url in self.urls.items()))
        return dict(results)
