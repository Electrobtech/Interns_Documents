"""LLM provider abstraction: Groq (primary) + Ollama (fallback + embeddings).

Carried forward from `ai-agent-backend/app/llm/`. The important inherited
constraint: Groq has no embeddings API, so embeddings always go to Ollama
regardless of which provider is generating.
"""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx
import structlog

from orbq_core.errors import LLMError

log = structlog.get_logger()


@dataclass(slots=True)
class Completion:
    text: str
    model: str
    provider: str
    tokens_in: int = 0
    tokens_out: int = 0


class LLMProvider(ABC):
    name: str

    @abstractmethod
    async def complete(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> Completion: ...

    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError(f"{self.name} does not support embeddings")

    @abstractmethod
    async def health(self) -> bool: ...


class GroqProvider(LLMProvider):
    """OpenAI-compatible chat completions against Groq."""

    name = "groq"

    def __init__(self, *, api_key: str, base_url: str, model: str, timeout: float = 60.0):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    async def complete(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> Completion:
        if not self.api_key:
            raise LLMError("GROQ_API_KEY is not configured")

        payload: dict = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise LLMError(
                    f"Groq returned {exc.response.status_code}: {exc.response.text[:200]}"
                ) from exc
            except httpx.HTTPError as exc:
                raise LLMError(f"Groq request failed: {exc}") from exc

        data = resp.json()
        usage = data.get("usage", {})
        return Completion(
            text=data["choices"][0]["message"]["content"],
            model=self.model,
            provider=self.name,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
        )

    async def health(self) -> bool:
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                return resp.status_code == 200
        except httpx.HTTPError:
            return False


class OllamaProvider(LLMProvider):
    """Local inference. Fallback for generation, and always the embedder."""

    name = "ollama"

    def __init__(
        self,
        *,
        host: str,
        model: str,
        embedding_model: str = "nomic-embed-text",
        timeout: float = 120.0,
    ):
        self.host = host.rstrip("/")
        self.model = model
        self.embedding_model = embedding_model
        self.timeout = timeout

    async def complete(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> Completion:
        payload: dict = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        if json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.post(f"{self.host}/api/chat", json=payload)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                raise LLMError(f"Ollama request failed: {exc}") from exc

        data = resp.json()
        return Completion(
            text=data.get("message", {}).get("content", ""),
            model=self.model,
            provider=self.name,
            tokens_in=data.get("prompt_eval_count", 0),
            tokens_out=data.get("eval_count", 0),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch. Ollama's endpoint is single-text, so we fan out with
        bounded concurrency — unbounded gather on a 500-chunk document will
        exhaust the connection pool and time out."""
        sem = asyncio.Semaphore(4)

        async with httpx.AsyncClient(timeout=self.timeout) as client:

            async def one(text: str) -> list[float]:
                async with sem:
                    try:
                        resp = await client.post(
                            f"{self.host}/api/embeddings",
                            json={"model": self.embedding_model, "prompt": text},
                        )
                        resp.raise_for_status()
                    except httpx.HTTPError as exc:
                        raise LLMError(f"Ollama embedding failed: {exc}") from exc
                    return resp.json()["embedding"]

            return list(await asyncio.gather(*(one(t) for t in texts)))

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.host}/api/tags")
                return resp.status_code == 200
        except httpx.HTTPError:
            return False


class FallbackProvider(LLMProvider):
    """Tries providers in order. Records which one served the request so the
    decision trace can show that a fallback occurred (§10.7)."""

    name = "fallback"

    def __init__(self, providers: list[LLMProvider]):
        if not providers:
            raise ValueError("FallbackProvider needs at least one provider")
        self.providers = providers

    async def complete(self, **kwargs) -> Completion:
        errors: list[str] = []
        for provider in self.providers:
            try:
                return await provider.complete(**kwargs)
            except LLMError as exc:
                errors.append(f"{provider.name}: {exc}")
                log.warning("llm_provider_failed", provider=provider.name, error=str(exc))
                continue
        raise LLMError(f"All LLM providers failed — {'; '.join(errors)}")

    async def embed(self, texts: list[str]) -> list[list[float]]:
        for provider in self.providers:
            try:
                return await provider.embed(texts)
            except (LLMError, NotImplementedError):
                continue
        raise LLMError("No provider in the chain supports embeddings")

    async def health(self) -> bool:
        results = await asyncio.gather(
            *(p.health() for p in self.providers), return_exceptions=True
        )
        return any(r is True for r in results)
