"""LLM client: provider selection, retries, JSON repair, token accounting.

The JSON repair loop is the part that matters most in practice. Models emit
markdown-fenced JSON, trailing prose, and occasional truncation; without repair,
a capability fails on formatting rather than substance.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any, TypeVar

import structlog
from pydantic import BaseModel, ValidationError as PydanticValidationError

from orbq_core.errors import LLMError, LLMOutputInvalidError

from .providers import Completion, FallbackProvider, GroqProvider, LLMProvider, OllamaProvider

log = structlog.get_logger()

T = TypeVar("T", bound=BaseModel)

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def build_provider_chain(
    *,
    primary: str,
    groq_api_key: str,
    groq_base_url: str,
    groq_model: str,
    ollama_host: str,
    ollama_model: str,
    embedding_model: str,
) -> tuple[LLMProvider, LLMProvider]:
    """Return (generation_provider, embedding_provider).

    Embeddings are always Ollama: Groq has no embeddings API. Returning them
    separately makes that explicit rather than a surprise at call time.
    """
    groq = GroqProvider(api_key=groq_api_key, base_url=groq_base_url, model=groq_model)
    ollama = OllamaProvider(
        host=ollama_host, model=ollama_model, embedding_model=embedding_model
    )

    chain = [groq, ollama] if primary == "groq" else [ollama, groq]
    return FallbackProvider(chain), ollama


def extract_json(raw: str) -> str:
    """Pull a JSON object out of a model response.

    Handles the three failure shapes seen in practice: fenced code blocks,
    leading prose before the object, and trailing commentary after it.
    """
    text = raw.strip()

    fenced = _FENCE_RE.search(text)
    if fenced:
        text = fenced.group(1).strip()

    if text.startswith("{") or text.startswith("["):
        return text

    # Fall back to the outermost brace/bracket pair.
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end > start:
            return text[start : end + 1]

    return text


class LLMClient:
    def __init__(self, provider: LLMProvider, embedder: LLMProvider) -> None:
        self.provider = provider
        self.embedder = embedder

    async def complete(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> Completion:
        started = time.perf_counter()
        completion = await self.provider.complete(
            system=system,
            user=user,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )
        log.info(
            "llm_completion",
            provider=completion.provider,
            model=completion.model,
            tokens_in=completion.tokens_in,
            tokens_out=completion.tokens_out,
            duration_ms=round((time.perf_counter() - started) * 1000, 1),
        )
        return completion

    async def complete_structured(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        temperature: float = 0.2,
        max_tokens: int = 2048,
        repair_attempts: int = 1,
    ) -> tuple[T, Completion]:
        """Complete and validate against a Pydantic schema, repairing once.

        Schema validation is a security control as much as a correctness one:
        it is what prevents a prompt-injected instruction from producing an
        out-of-contract action (§18.4).
        """
        completion = await self.complete(
            system=system,
            user=user,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=True,
        )

        last_error: str = ""
        for attempt in range(repair_attempts + 1):
            try:
                payload = json.loads(extract_json(completion.text))
                return schema.model_validate(payload), completion
            except (json.JSONDecodeError, PydanticValidationError) as exc:
                last_error = str(exc)
                if attempt >= repair_attempts:
                    break

                log.warning("llm_output_repair", attempt=attempt + 1, error=last_error[:300])
                repair = await self.complete(
                    system=(
                        "You fix malformed JSON. Return ONLY valid JSON matching the "
                        "requested schema. No prose, no markdown fences."
                    ),
                    user=(
                        f"This output failed validation:\n\n{completion.text[:4000]}\n\n"
                        f"Validation error:\n{last_error[:1000]}\n\n"
                        f"Required schema:\n{json.dumps(schema.model_json_schema(), indent=2)[:2000]}\n\n"
                        "Return the corrected JSON only."
                    ),
                    temperature=0.0,
                    max_tokens=max_tokens,
                    json_mode=True,
                )
                # Preserve cumulative token cost across the repair round-trip.
                repair.tokens_in += completion.tokens_in
                repair.tokens_out += completion.tokens_out
                completion = repair

        raise LLMOutputInvalidError(
            f"Model output failed schema validation after {repair_attempts} repair "
            f"attempt(s): {last_error[:400]}"
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await self.embedder.embed(texts)

    async def health(self) -> dict[str, bool]:
        return {
            "generation": await self.provider.health(),
            "embeddings": await self.embedder.health(),
        }
