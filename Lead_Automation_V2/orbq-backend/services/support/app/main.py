"""orbq-support — the Support Agent.

Hosts support capabilities. Exposes only /internal/*, never gateway-routed.
Bootstrap lives in orbq_ai.service so all three agents stay structurally
identical; the difference between them is their capabilities, nothing else.
"""
from __future__ import annotations

from functools import lru_cache

from orbq_ai.service import AgentServiceSettings, create_agent_service

from .capabilities import ALL_CAPABILITIES


class Settings(AgentServiceSettings):
    service_name: str = "orbq-support"
    port: int = 4023


@lru_cache
def get_settings() -> Settings:
    return Settings()


app = create_agent_service(
    title="Orbq — Support Agent",
    settings=get_settings(),
    capabilities=ALL_CAPABILITIES,
)
