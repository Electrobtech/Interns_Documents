"""Wraps a primary + fallback provider.

If the primary's agenerate() call fails, retries once on the fallback.
Embeddings always use the fallback provider if the primary can't embed
(e.g. Groq has no embeddings API).

Every call is logged to provider_usage_logs via an injected AsyncSession,
which is optional so the provider can still be used in contexts without a DB
session (e.g. health checks, tests).
"""
from __future__ import annotations

import logging
import time
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.base import ChatMessage, LLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class FallbackLLMProvider(LLMProvider):
    name = "fallback"

    def __init__(self, primary: LLMProvider, fallback: LLMProvider) -> None:
        self._primary = primary
        self._fallback = fallback

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _log(
        self,
        session: AsyncSession | None,
        *,
        provider: str,
        model: str,
        operation: str,
        agent_type: str | None,
        organization_id: uuid.UUID | None,
        fallback_used: bool,
        latency_ms: int | None,
        prompt_tokens: int | None,
        completion_tokens: int | None,
        status: str,
        error_message: str | None = None,
    ) -> None:
        if session is None:
            return
        try:
            from app.repositories.provider_log_repo import ProviderLogRepository
            await ProviderLogRepository(session).record(
                provider=provider, model=model, operation=operation,
                agent_type=agent_type, organization_id=organization_id,
                fallback_used=fallback_used, latency_ms=latency_ms,
                prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
                status=status, error_message=error_message,
            )
            # Don't commit here — caller owns the transaction.
        except Exception:
            logger.debug("provider_log_write_failed", exc_info=True)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def agenerate(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.4,
        max_tokens: int | None = None,
        json_mode: bool = False,
        # Logging context — injected by services that want usage tracking.
        _session: AsyncSession | None = None,
        _agent_type: str | None = None,
        _organization_id: uuid.UUID | None = None,
    ) -> LLMResponse:
        t0 = time.monotonic()
        try:
            result = await self._primary.agenerate(
                messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode
            )
            await self._log(
                _session,
                provider=self._primary.name,
                model=result.model,
                operation="generate",
                agent_type=_agent_type,
                organization_id=_organization_id,
                fallback_used=False,
                latency_ms=result.raw.get("_latency_ms"),
                prompt_tokens=result.raw.get("_prompt_tokens"),
                completion_tokens=result.raw.get("_completion_tokens"),
                status="ok",
            )
            return result
        except Exception as exc:
            primary_latency = int((time.monotonic() - t0) * 1000)
            logger.warning(
                "primary_llm_failed provider=%s, falling back to %s",
                self._primary.name, self._fallback.name, exc_info=True,
            )
            await self._log(
                _session,
                provider=self._primary.name,
                model=getattr(self._primary, "_model", "unknown"),
                operation="generate",
                agent_type=_agent_type,
                organization_id=_organization_id,
                fallback_used=True,
                latency_ms=primary_latency,
                prompt_tokens=None,
                completion_tokens=None,
                status="error",
                error_message=str(exc)[:256],
            )
            result = await self._fallback.agenerate(
                messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode
            )
            await self._log(
                _session,
                provider=self._fallback.name,
                model=result.model,
                operation="generate",
                agent_type=_agent_type,
                organization_id=_organization_id,
                fallback_used=True,
                latency_ms=result.raw.get("_latency_ms"),
                prompt_tokens=result.raw.get("_prompt_tokens"),
                completion_tokens=result.raw.get("_completion_tokens"),
                status="ok",
            )
            return result

    async def embed(self, texts: list[str]) -> list[list[float]]:
        try:
            return await self._primary.embed(texts)
        except NotImplementedError:
            return await self._fallback.embed(texts)

    async def health_check(self) -> bool:
        return await self._primary.health_check() or await self._fallback.health_check()
