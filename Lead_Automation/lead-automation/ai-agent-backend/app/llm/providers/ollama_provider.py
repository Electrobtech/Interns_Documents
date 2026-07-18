"""Ollama — local fallback generation + always-on embedding provider."""
from __future__ import annotations

import time

import httpx

from app.llm.base import ChatMessage, LLMProvider, LLMResponse


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, host: str, model: str, embedding_model: str) -> None:
        self._host = host.rstrip("/")
        self._model = model
        self._embedding_model = embedding_model

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
            "stream": False,
            "options": {"temperature": temperature},
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        if json_mode:
            payload["format"] = "json"

        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{self._host}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
        latency_ms = int((time.monotonic() - t0) * 1000)

        response = LLMResponse(
            content=data["message"]["content"],
            model=self._model,
            raw=data,
        )
        # Attach metadata for instrumented wrapper.
        response.raw["_latency_ms"] = latency_ms
        response.raw["_prompt_tokens"] = data.get("prompt_eval_count")
        response.raw["_completion_tokens"] = data.get("eval_count")
        return response

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        async with httpx.AsyncClient(timeout=60) as client:
            for text in texts:
                resp = await client.post(
                    f"{self._host}/api/embeddings",
                    json={"model": self._embedding_model, "prompt": text},
                )
                resp.raise_for_status()
                vectors.append(resp.json()["embedding"])
        return vectors

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self._host}/api/tags")
                return resp.status_code == 200
        except httpx.HTTPError:
            return False
