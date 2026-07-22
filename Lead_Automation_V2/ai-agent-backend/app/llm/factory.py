"""get_llm_provider() — the ONLY place agent code gets an LLMProvider from.
Selection is driven entirely by LLM_PROVIDER (env var).

Supported values: "groq" | "ollama"
Swapping providers is a config change, never a code change.
"""
from __future__ import annotations

from functools import lru_cache

from app.config.settings import Settings, get_settings
from app.llm.base import LLMProvider
from app.llm.providers.fallback_provider import FallbackLLMProvider
from app.llm.providers.groq_provider import GroqProvider
from app.llm.providers.ollama_provider import OllamaProvider


def build_provider(name: str, settings: Settings | None = None) -> LLMProvider:
    settings = settings or get_settings()
    if name == "groq":
        return GroqProvider(
            api_key=settings.GROQ_API_KEY,
            base_url=settings.GROQ_BASE_URL,
            model=settings.GROQ_MODEL,
        )
    if name == "ollama":
        return OllamaProvider(
            host=settings.OLLAMA_HOST,
            model=settings.OLLAMA_MODEL,
            embedding_model=settings.EMBEDDING_MODEL,
        )
    raise ValueError(
        f"Unknown LLM_PROVIDER: {name!r}. "
        f"Supported: 'groq', 'ollama'"
    )


@lru_cache
def _cached_provider() -> LLMProvider:
    settings = get_settings()
    primary = build_provider(settings.LLM_PROVIDER, settings)
    if settings.LLM_FALLBACK_PROVIDER and settings.LLM_FALLBACK_PROVIDER != settings.LLM_PROVIDER:
        fallback = build_provider(settings.LLM_FALLBACK_PROVIDER, settings)
        return FallbackLLMProvider(primary, fallback)
    return primary


def get_llm_provider() -> LLMProvider:
    return _cached_provider()


def get_embedding_provider() -> LLMProvider:
    """Embeddings always route through Ollama, regardless of the active
    generation provider (Groq has no embeddings API)."""
    return build_provider("ollama")
