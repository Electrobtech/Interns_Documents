"""Structure-aware chunking — carried forward from ai-agent-backend (§11.1).

Naive fixed-width splitting cuts sentences in half, orphans table rows from
their headers, and strips the heading context that tells a retriever what a
passage is about. This preserves all three:

  * heading breadcrumbs prepended to each chunk
  * abbreviation-safe sentence splitting
  * list and table blocks kept atomic
  * overlap aligned to sentence boundaries, not character counts
"""
from __future__ import annotations

import re
from dataclasses import dataclass

TARGET_CHARS = 900
OVERLAP_CHARS = 150
MIN_CHARS = 120

# Abbreviations that end in '.' but do not end a sentence. Without this,
# "approx. 40% of Q3 revenue" splits after "approx."
_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "inc", "ltd", "co", "corp",
    "vs", "etc", "e.g", "i.e", "approx", "fig", "no", "vol", "dept", "est", "min",
    "max", "avg", "qty", "ref", "cf", "al",
}

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")
_SETEXT_RE = re.compile(r"^(={3,}|-{3,})$")
_LIST_ITEM_RE = re.compile(r"^\s*(?:[-*+•]|\d+[.)])\s+")
_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")
_SENTENCE_END_RE = re.compile(r"([.!?])\s+")


@dataclass(slots=True)
class Chunk:
    content: str
    index: int
    heading_path: str | None = None


def _is_abbreviation(text: str, period_pos: int) -> bool:
    start = period_pos
    while start > 0 and (text[start - 1].isalnum() or text[start - 1] == "."):
        start -= 1
    return text[start:period_pos].lower().strip(".") in _ABBREVIATIONS


def split_sentences(text: str) -> list[str]:
    """Sentence split that respects abbreviations and decimals."""
    sentences: list[str] = []
    start = 0
    for match in _SENTENCE_END_RE.finditer(text):
        end = match.start()
        # "3.5%" — a period between digits is a decimal, not a full stop.
        if text[end] == "." and end > 0 and end + 1 < len(text):
            if text[end - 1].isdigit() and text[end + 1 :][:1].isdigit():
                continue
        if _is_abbreviation(text, end):
            continue
        sentences.append(text[start : match.end()].strip())
        start = match.end()

    tail = text[start:].strip()
    if tail:
        sentences.append(tail)
    return [s for s in sentences if s]


@dataclass(slots=True)
class _Block:
    """A structural unit. `atomic` blocks are never split internally."""

    text: str
    heading_path: str
    atomic: bool = False


def _parse_blocks(text: str) -> list[_Block]:
    """Group lines into blocks, tracking the heading breadcrumb."""
    lines = text.splitlines()
    blocks: list[_Block] = []
    heading_stack: list[tuple[int, str]] = []
    buffer: list[str] = []
    buffer_atomic = False

    def flush() -> None:
        nonlocal buffer, buffer_atomic
        body = "\n".join(buffer).strip()
        if body:
            blocks.append(
                _Block(
                    text=body,
                    heading_path=" › ".join(h for _, h in heading_stack),
                    atomic=buffer_atomic,
                )
            )
        buffer = []
        buffer_atomic = False

    for i, line in enumerate(lines):
        heading = _HEADING_RE.match(line)
        # Setext heading: text underlined with === or ---
        if not heading and _SETEXT_RE.match(line.strip()) and buffer:
            level = 1 if line.strip().startswith("=") else 2
            title = buffer[-1].strip()
            buffer = buffer[:-1]
            flush()
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, title))
            continue

        if heading:
            flush()
            level = len(heading.group(1))
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, heading.group(2).strip()))
            continue

        is_structured = bool(_LIST_ITEM_RE.match(line) or _TABLE_ROW_RE.match(line))

        if not line.strip():
            # Blank line ends a paragraph, but not a list/table run — those are
            # often separated by blank lines yet belong together.
            next_structured = (
                i + 1 < len(lines)
                and bool(_LIST_ITEM_RE.match(lines[i + 1]) or _TABLE_ROW_RE.match(lines[i + 1]))
            )
            if not (buffer_atomic and next_structured):
                flush()
            continue

        if is_structured:
            buffer_atomic = True
        buffer.append(line)

    flush()
    return blocks


def chunk_text(
    text: str,
    *,
    target: int = TARGET_CHARS,
    overlap: int = OVERLAP_CHARS,
    minimum: int = MIN_CHARS,
) -> list[Chunk]:
    """Split into retrievable chunks, preserving structure and heading context."""
    if not text or not text.strip():
        return []

    chunks: list[Chunk] = []
    current: list[str] = []
    current_len = 0
    current_heading = ""

    def emit() -> None:
        nonlocal current, current_len
        body = "\n".join(current).strip()
        if body:
            chunks.append(
                Chunk(
                    content=body,
                    index=len(chunks),
                    heading_path=current_heading or None,
                )
            )
        current = []
        current_len = 0

    for block in _parse_blocks(text):
        # A heading change starts a new chunk: mixing sections dilutes the
        # embedding and produces a chunk that is "about" two things.
        if block.heading_path != current_heading and current:
            emit()
        current_heading = block.heading_path

        if block.atomic or len(block.text) <= target:
            if current_len + len(block.text) > target and current:
                emit()
                current_heading = block.heading_path
            current.append(block.text)
            current_len += len(block.text)
            if current_len >= target:
                emit()
                current_heading = block.heading_path
            continue

        # Long prose block: split on sentence boundaries with sentence-aligned
        # overlap, so no chunk begins or ends mid-thought.
        sentences = split_sentences(block.text)
        for sentence in sentences:
            if current_len + len(sentence) > target and current:
                carry: list[str] = []
                carry_len = 0
                for prev in reversed(current):
                    if carry_len + len(prev) > overlap:
                        break
                    carry.insert(0, prev)
                    carry_len += len(prev)
                emit()
                current_heading = block.heading_path
                current = list(carry)
                current_len = carry_len
            current.append(sentence)
            current_len += len(sentence)

    emit()

    # Fold a runt tail into its predecessor — a 20-character chunk carries no
    # usable signal and pollutes retrieval.
    if len(chunks) > 1 and len(chunks[-1].content) < minimum:
        tail = chunks.pop()
        chunks[-1] = Chunk(
            content=f"{chunks[-1].content}\n{tail.content}",
            index=chunks[-1].index,
            heading_path=chunks[-1].heading_path,
        )

    return chunks


def embeddable_text(chunk: Chunk) -> str:
    """What actually gets embedded.

    The heading breadcrumb is prepended so a chunk reading "Rates start at
    $49/mo" carries "Pricing › Enterprise" with it — without that, the passage
    is ambiguous and retrieves poorly.
    """
    if chunk.heading_path:
        return f"{chunk.heading_path}\n\n{chunk.content}"
    return chunk.content
