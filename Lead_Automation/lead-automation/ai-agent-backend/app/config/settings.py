"""Central settings — LLM_PROVIDER is the single switch between Groq, Kimi,
and Ollama; no code change needed to swap, only this env var.

Supported values for LLM_PROVIDER / LLM_FALLBACK_PROVIDER:
  "groq"   — Groq Cloud (fast Llama 3.3 inference)
  "kimi"   — Moonshot AI Kimi (long-context, OpenAI-compatible)
  "ollama" — local Ollama (always-on embeddings + generation fallback)
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://lead:leadpass@postgres:5432/lead_automation"
    JWT_SECRET: str = "dev-secret"

    # LLM_PROVIDER: "groq" | "kimi" | "ollama"
    # LLM_FALLBACK_PROVIDER is tried automatically if the primary fails.
    LLM_PROVIDER: str = "kimi"
    LLM_FALLBACK_PROVIDER: str = "groq"

    # ── Groq ──────────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ── Kimi (Moonshot AI) ────────────────────────────────────────────────────
    KIMI_API_KEY: str = ""
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    # moonshot-v1-8k | moonshot-v1-32k | moonshot-v1-128k
    KIMI_MODEL: str = "moonshot-v1-32k"

    # ── Ollama (local fallback + all embeddings) ───────────────────────────────
    OLLAMA_HOST: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen3:8b"
    EMBEDDING_MODEL: str = "nomic-embed-text"

    CONTACT_SERVICE_URL: str = "http://contact-service:4003"
    CAMPAIGN_SERVICE_URL: str = "http://campaign-service:4004"


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_settings() -> Settings:
    return Settings()
