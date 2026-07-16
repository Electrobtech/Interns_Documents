"""Semantic-ish chunking: split on paragraph/sentence boundaries first, then
pack into ~target-sized chunks with a trailing overlap carried into the next
chunk, so a fact split across a boundary is still retrievable from either side."""
from __future__ import annotations

import re
from dataclasses import dataclass

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


@dataclass
class Chunk:
    text: str
    metadata: dict


def _split_sentences(text: str) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    sentences: list[str] = []
    for para in paragraphs:
        sentences.extend(s for s in _SENTENCE_SPLIT.split(para) if s.strip())
    return sentences


def chunk_text(text: str, metadata: dict, *, target_chars: int = 900, overlap_chars: int = 150) -> list[Chunk]:
    sentences = _split_sentences(text)
    if not sentences:
        return []

    chunks: list[Chunk] = []
    current: list[str] = []
    current_len = 0

    for sentence in sentences:
        if current_len + len(sentence) > target_chars and current:
            chunk_body = " ".join(current)
            chunks.append(Chunk(text=chunk_body, metadata=dict(metadata)))
            # Carry the tail of this chunk forward as overlap context.
            overlap_text = chunk_body[-overlap_chars:]
            current = [overlap_text, sentence]
            current_len = len(overlap_text) + len(sentence)
        else:
            current.append(sentence)
            current_len += len(sentence)

    if current:
        chunks.append(Chunk(text=" ".join(current), metadata=dict(metadata)))

    return chunks
