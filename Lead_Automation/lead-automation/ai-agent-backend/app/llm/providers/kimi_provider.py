"""Kimi (Moonshot AI) — OpenAI-compatible chat completions.
Uses the same interface as Groq so it drops into the provider router
with zero changes to agent code.

Docs: https://platform.moonshot.cn/docs/api/chat
Base URL: https://api.moonshot.cn/v1
Models: moonshot-v1-8k | moonshot-v1-32k | moonshot-v1-128k
"""
from __future__ import annotations

import json
import time

import httpx

from app.llm.base import ChatMessage, LLMProvider, LLMResponse


class KimiProvider(LLMProvider):
    name = "kimi"

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def agenerate(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.4,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        payload: dict = {
            "model": self._model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        # Kimi supports OpenAI-style response_format for JSON mode
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                content=json.dumps(payload),
            )
            resp.raise_for_status()
            data = resp.json()
        latency_ms = int((time.monotonic() - t0) * 1000)

        choice = data["choices"][0]["message"]
        usage = data.get("usage", {})

        response = LLMResponse(
            content=choice["content"],
            model=data.get("model", self._model),
            raw=data,
        )
        # Attach usage metadata for the instrumented FallbackLLMProvider wrapper.
        response.raw["_latency_ms"] = latency_ms
        response.raw["_prompt_tokens"] = usage.get("prompt_tokens")
        response.raw["_completion_tokens"] = usage.get("completion_tokens")
        return response

    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError(
            "Kimi has no public embeddings API — embeddings always route through Ollama."
        )

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{self._base_url}/models",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                return resp.status_code == 200
        except httpx.HTTPError:
            return False
