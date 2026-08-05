"""orbq-sales — the Sales Agent.

Hosts sales capabilities. Exposes only /internal/*, never gateway-routed.
Bootstrap lives in orbq_ai.service so all three agents stay structurally
identical; the difference between them is their capabilities, nothing else.
"""
from __future__ import annotations

from functools import lru_cache

from orbq_ai.service import AgentServiceSettings, create_agent_service

from .capabilities import ALL_CAPABILITIES


class Settings(AgentServiceSettings):
    service_name: str = "orbq-sales"
    port: int = 4022


@lru_cache
def get_settings() -> Settings:
    return Settings()


app = create_agent_service(
    title="Orbq — Sales Agent",
    settings=get_settings(),
    capabilities=ALL_CAPABILITIES,
)
