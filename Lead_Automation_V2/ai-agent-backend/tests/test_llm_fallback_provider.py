"""FallbackLLMProvider had zero test coverage before this file — which is
how the double-failure bug below shipped unnoticed. Pure unit tests against
the class directly (no DB, no app client needed): _log() no-ops when
_session=None, so these run with nothing but two fake LLMProvider stubs.
"""
from __future__ import annotations

import pytest

from app.llm.base import ChatMessage, LLMProvider, LLMProviderUnavailable, LLMResponse
from app.llm.providers.fallback_provider import FallbackLLMProvider

pytestmark = pytest.mark.asyncio

_MSGS = [ChatMessage(role="user", content="hi")]


class _OkProvider(LLMProvider):
    name = "ok"

    async def agenerate(self, messages, *, temperature=0.4, max_tokens=None, json_mode=False):
        return LLMResponse(content="fine", model="ok-model")

    async def embed(self, texts):
        return [[0.0] for _ in texts]


class _FailingProvider(LLMProvider):
    def __init__(self, name: str, exc: Exception) -> None:
        self.name = name
        self._exc = exc

    async def agenerate(self, messages, *, temperature=0.4, max_tokens=None, json_mode=False):
        raise self._exc

    async def embed(self, texts):
        raise self._exc


async def test_agenerate_uses_fallback_when_primary_fails():
    provider = FallbackLLMProvider(
        primary=_FailingProvider("groq", ConnectionError("groq down")),
        fallback=_OkProvider(),
    )
    result = await provider.agenerate(_MSGS)
    assert result.content == "fine"


async def test_agenerate_raises_llm_provider_unavailable_when_both_fail():
    """The bug this session found live: both primary and fallback failing
    used to propagate the fallback's raw exception (e.g. httpx.ConnectError)
    straight to the caller — an unhandled 500 with no clear error message.
    Now it raises a single, catchable LLMProviderUnavailable instead."""
    provider = FallbackLLMProvider(
        primary=_FailingProvider("groq", ConnectionError("groq down")),
        fallback=_FailingProvider("ollama", ConnectionError("ollama down")),
    )
    with pytest.raises(LLMProviderUnavailable) as exc_info:
        await provider.agenerate(_MSGS)
    assert "groq" in str(exc_info.value)
    assert "ollama" in str(exc_info.value)


async def test_agenerate_succeeds_when_primary_works():
    provider = FallbackLLMProvider(primary=_OkProvider(), fallback=_FailingProvider("ollama", ConnectionError("x")))
    result = await provider.agenerate(_MSGS)
    assert result.content == "fine"
    assert result.model == "ok-model"
