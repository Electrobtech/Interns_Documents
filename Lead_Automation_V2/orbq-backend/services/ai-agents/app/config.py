"""Settings for orbq-ai-agents."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field

from orbq_core.config import BaseServiceSettings


class Settings(BaseServiceSettings):
    service_name: str = "orbq-ai-agents"
    port: int = 4020

    # ---- agent tier ----
    marketing_service_url: str = "http://orbq-marketing:4021"
    sales_service_url: str = "http://orbq-sales:4022"
    support_service_url: str = "http://orbq-support:4023"

    # ---- anti-corruption layer → Node platform (§7.2) ----
    contact_service_url: str = "http://contact-service:4003"
    campaign_service_url: str = "http://campaign-service:4004"
    automation_service_url: str = "http://automation-service:4011"
    notification_service_url: str = "http://notification-service:4012"

    # ---- LLM ----
    llm_provider: str = "groq"
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.3-70b-versatile"
    ollama_host: str = "http://ollama:11434"
    ollama_model: str = "qwen3:8b"
    embedding_model: str = "nomic-embed-text"

    # ---- RAG (§11.3: promoted from hardcoded constants to settings) ----
    rag_rrf_k: int = 60
    rag_mmr_lambda: float = 0.7
    rag_confidence_threshold: float = 0.50
    rag_llm_rerank: bool = False
    rag_rerank_candidates: int = 12
    rag_top_k: int = 6

    # ---- chunking ----
    chunk_target_chars: int = 900
    chunk_overlap_chars: int = 150
    chunk_min_chars: int = 120

    # ---- quota (§17.3) ----
    max_concurrent_executions_per_org: int = 10
    monthly_credit_limit: int = 100_000

    mongo_url: str = "mongodb://orbq-mongo:27017/orbq"

    # ---- media (Assets Library) ----
    # Local-disk volume, same caveat as the Node platform's auth_uploads /
    # automation_uploads: swap for S3/R2 before running >1 replica.
    media_root: str = "/app/uploads"

    agent_service_timeout: float = Field(
        default=120.0,
        description=(
            "Longer than the default HTTP read timeout because a capability "
            "wraps an LLM call — 10s would cancel legitimate work mid-inference."
        ),
    )

    def agent_url(self, workspace: str) -> str:
        return {
            "marketing": self.marketing_service_url,
            "sales": self.sales_service_url,
            "support": self.support_service_url,
        }[workspace]


@lru_cache
def get_settings() -> Settings:
    return Settings()
