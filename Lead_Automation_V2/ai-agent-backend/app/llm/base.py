"""LLMProvider ABC — agents depend only on this. Switching between Groq and
Ollama is a LLM_PROVIDER env var change, never a code change."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChatMessage:
    role: str
    content: str


@dataclass
class LLMResponse:
    content: str
    model: str
    raw: dict[str, Any] = field(default_factory=dict)


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def agenerate(
        self, messages: list[ChatMessage], *, temperature: float = 0.4, max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        raise NotImplementedError

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    async def health_check(self) -> bool:
        return True


class LLMProviderUnavailable(Exception):
    """Raised when neither the primary nor the fallback LLM provider could
    complete a request. Distinct from a malformed/unexpected response (which
    callers already handle per-agent, e.g. wrapping raw text when JSON
    parsing fails) — this means no content came back at all. Routes should
    map this to a 503, not let it surface as an unhandled 500."""
