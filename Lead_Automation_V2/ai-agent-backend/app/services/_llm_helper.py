"""Shared helper for calling agenerate() with usage-logging context. The
logging kwargs (_session/_agent_type/_organization_id) are only accepted by
FallbackLLMProvider — a raw, unwrapped provider (LLM_FALLBACK_PROVIDER unset
or equal to LLM_PROVIDER) would raise on an unexpected keyword argument, so
this checks the concrete type before passing them."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.base import ChatMessage, LLMProvider, LLMResponse
from app.llm.providers.fallback_provider import FallbackLLMProvider


async def generate_logged(
    provider: LLMProvider,
    messages: list[ChatMessage],
    *,
    agent_type: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
    temperature: float = 0.5,
    max_tokens: int | None = 1800,
    json_mode: bool = True,
) -> LLMResponse:
    if isinstance(provider, FallbackLLMProvider):
        return await provider.agenerate(
            messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode,
            _session=session, _agent_type=agent_type, _organization_id=organization_id,
        )
    return await provider.agenerate(
        messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode,
    )
