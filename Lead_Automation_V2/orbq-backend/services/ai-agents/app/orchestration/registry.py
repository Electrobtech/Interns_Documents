"""Capability registry — the orchestrator's view of what the agent tier can do.

Populated by discovery at startup and refreshed periodically, so deploying a new
capability requires no orchestrator change (§10.2).
"""
from __future__ import annotations

import asyncio
import time

import structlog

from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityManifest

from ..clients.agent_client import AgentServiceClient

log = structlog.get_logger()

REFRESH_INTERVAL_SECONDS = 300.0


class CapabilityRegistry:
    def __init__(self, client: AgentServiceClient) -> None:
        self.client = client
        self._by_workspace: dict[str, dict[str, CapabilityManifest]] = {}
        self._refreshed_at: float = 0.0
        self._lock = asyncio.Lock()

    async def refresh(self) -> None:
        async with self._lock:
            results = await asyncio.gather(
                *(self.client.discover(ws.value) for ws in Workspace),
                return_exceptions=True,
            )
            for ws, result in zip(Workspace, results, strict=True):
                if isinstance(result, BaseException):
                    log.warning("registry_refresh_failed", workspace=ws.value, error=str(result))
                    continue
                self._by_workspace[ws.value] = result
            self._refreshed_at = time.monotonic()

    async def ensure_fresh(self) -> None:
        if time.monotonic() - self._refreshed_at > REFRESH_INTERVAL_SECONDS:
            await self.refresh()

    def for_workspace(self, workspace: Workspace | str) -> dict[str, CapabilityManifest]:
        ws = workspace.value if isinstance(workspace, Workspace) else str(workspace)
        return self._by_workspace.get(ws, {})

    def get(self, workspace: Workspace | str, name: str) -> CapabilityManifest | None:
        return self.for_workspace(workspace).get(name)

    def all(self) -> dict[str, dict[str, CapabilityManifest]]:
        return dict(self._by_workspace)

    @property
    def total(self) -> int:
        return sum(len(v) for v in self._by_workspace.values())
