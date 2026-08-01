"""Structure-aware chunking.

Retrieval quality is capped by chunk quality: a chunk that starts mid-sentence,
loses the heading it lived under, or splits a table row from its header will
never retrieve well no matter how good the embedding model is.

What this does beyond a naive character split:

* **Heading breadcrumbs.** Each chunk is prefixed with the heading path it came
  from ("Pricing > Enterprise plan"), so a chunk reading "Rs. 4,999 per seat"
  still embeds and reads as being *about* enterprise pricing.
* **Abbreviation-safe sentence splitting.** The previous splitter broke on every
  ``.``, shattering "Rs. 5,000", "No. 3", "v1.2", and "Dr. Rao" into fragments.
* **Atomic blocks.** Bullet lists and table rows are kept with their
  introducing line rather than split away from it.
* **Sentence-boundary overlap.** Overlap used to be a raw ``text[-150:]`` slice,
  which routinely began mid-word. Overlap is now whole trailing sentences.
* **Oversized-unit splitting.** A single sentence longer than the target (common
  in scraped HTML with no punctuation) used to produce one giant chunk; it is
  now split on word boundaries.
* **Tiny-chunk merging.** Trailing fragments below ``min_chars`` are merged back
  into the previous chunk instead of becoming near-empty entries that dilute
  search results.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# Abbreviations and patterns that must NOT end a sentence.
_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "rs", "no", "vs", "etc",
    "inc", "ltd", "pvt", "co", "corp", "approx", "dept", "est", "fig", "eg",
    "ext", "ref", "sec", "min", "max", "qty", "vol", "ch", "pp", "para", "cf",
    "ie", "am", "pm", "u.s", "u.k", "e.g", "i.e", "a.m", "p.m",
}

# Split after . ! ? only when the next token starts a new sentence: an uppercase
# letter, optionally behind an opening quote/bracket. Digits are deliberately
# excluded — sentences almost never start with a bare number, while
# abbreviations are routinely followed by one ("ext. 12", "No. 3"), and
# decimals ("4.5") must never split.
_SENTENCE_END = re.compile(r'(?<=[.!?])["\')\]]*\s+(?=["\'(\[]*[A-Z])')

_HEADING_MD = re.compile(r"^(#{1,6})\s+(.*)$")
# "1.2 Section title" / "SECTION TITLE" / "Title:" — common in extracted PDFs/DOCX.
_HEADING_NUMBERED = re.compile(r"^\s*(\d+(?:\.\d+)*)\s+([A-Z][^.!?]{2,80})$")
_LIST_ITEM = re.compile(r"^\s*(?:[-*•‣◦]|\d+[.)]|[a-z][.)])\s+")
_TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$|^\s*\S+(?:\s*\|\s*\S+)+\s*$")


@dataclass
class Chunk:
    text: str
    metadata: dict = field(default_factory=dict)


def _is_heading(line: str) -> tuple[int, str] | None:
    """Returns (level, title) when the line reads as a heading."""
    stripped = line.strip()
    if not stripped:
        return None

    md = _HEADING_MD.match(stripped)
    if md:
        return len(md.group(1)), md.group(2).strip()

    num = _HEADING_NUMBERED.match(stripped)
    if num:
        return num.group(1).count(".") + 1, f"{num.group(1)} {num.group(2)}".strip()

    # A short, title-cased or all-caps line with no terminal punctuation.
    if (
        len(stripped) <= 80
        and not stripped.endswith((".", "!", "?", ",", ";", ":"))
        and not _LIST_ITEM.match(stripped)
        and len(stripped.split()) <= 12
        and (stripped.isupper() or stripped.istitle())
    ):
        return 2, stripped.rstrip(":")

    if stripped.endswith(":") and len(stripped) <= 80 and len(stripped.split()) <= 12:
        return 3, stripped.rstrip(":")

    return None


def split_sentences(text: str) -> list[str]:
    """Abbreviation- and decimal-safe sentence split."""
    if not text.strip():
        return []

    raw = _SENTENCE_END.split(text.strip())
    out: list[str] = []
    for piece in raw:
        piece = piece.strip()
        if not piece:
            continue
        # Re-join when the previous fragment ended on a known abbreviation,
        # e.g. "Rs." + "5,000 per seat" was never two sentences.
        if out:
            tail = out[-1].rstrip()
            last_word = re.split(r"[\s(]", tail)[-1].rstrip(".").lower()
            if last_word in _ABBREVIATIONS or re.search(r"\b[A-Z]\.$", tail):
                out[-1] = f"{out[-1]} {piece}"
                continue
        out.append(piece)
    return out


def _hard_split(unit: str, target: int) -> list[str]:
    """Split an over-long unit on word boundaries so no chunk blows the target."""
    words = unit.split()
    parts: list[str] = []
    current: list[str] = []
    length = 0
    for w in words:
        if length + len(w) + 1 > target and current:
            parts.append(" ".join(current))
            current, length = [w], len(w)
        else:
            current.append(w)
            length += len(w) + 1
    if current:
        parts.append(" ".join(current))
    return parts


def _blocks(text: str, base_heading: str = "") -> list[tuple[list[str], str]]:
    """Group raw lines into (units, heading_path) blocks.

    A "unit" is an atom that must not be split further: one sentence, one list
    item, or one table row.

    ``base_heading`` seeds the breadcrumb for loaders that have already split
    the document by heading and consumed the heading line themselves (the
    markdown and HTML loaders emit one ExtractedPage per section with
    ``metadata["heading"]``). Without it those documents would chunk with no
    section context at all, since no ``#`` line ever reaches this function.
    """
    heading_stack: list[tuple[int, str]] = []
    if base_heading:
        heading_stack.append((1, base_heading))
    blocks: list[tuple[list[str], str]] = []
    buffer: list[str] = []
    pending_list: list[str] = []

    def heading_path() -> str:
        return " > ".join(t for _, t in heading_stack)

    def flush_prose() -> None:
        nonlocal buffer
        if buffer:
            joined = " ".join(buffer).strip()
            if joined:
                blocks.append((split_sentences(joined), heading_path()))
            buffer = []

    def flush_list() -> None:
        nonlocal pending_list
        if pending_list:
            blocks.append((list(pending_list), heading_path()))
            pending_list = []

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            flush_prose()
            flush_list()
            continue

        # Structural lines are tested BEFORE headings: a table row like
        # "| Growth | Rs. 4,999 | 30 |" is short, unpunctuated and title-ish,
        # so the heading heuristic would otherwise claim it and the row's data
        # would be swallowed into the breadcrumb instead of being indexed.
        if _LIST_ITEM.match(line) or _TABLE_ROW.match(line):
            flush_prose()
            pending_list.append(line.strip())
            continue

        head = _is_heading(line)
        if head:
            flush_prose()
            flush_list()
            level, title = head
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, title))
            continue

        flush_list()
        buffer.append(line.strip())

    flush_prose()
    flush_list()
    return blocks


def chunk_text(
    text: str,
    metadata: dict,
    *,
    target_chars: int = 900,
    overlap_chars: int = 150,
    min_chars: int = 120,
) -> list[Chunk]:
    """Split ``text`` into retrieval-sized chunks carrying heading context.

    ``metadata`` from the loader (page number, source heading, url) is copied
    onto every chunk and extended with the detected ``section`` breadcrumb.
    """
    if not text or not text.strip():
        return []

    # Loaders that pre-split by heading pass it as metadata["heading"]; use it
    # as the root of the breadcrumb so those chunks keep their section context.
    base_heading = str(metadata.get("heading") or metadata.get("title") or "").strip()
    blocks = _blocks(text, base_heading)
    if not blocks:
        return []

    chunks: list[Chunk] = []
    current: list[str] = []
    current_len = 0
    current_section = ""

    def emit() -> None:
        nonlocal current, current_len
        body = " ".join(current).strip()
        if not body:
            current, current_len = [], 0
            return
        meta = dict(metadata)
        if current_section:
            meta["section"] = current_section
        # The heading path is prepended to the embedded text so the chunk
        # carries its own context, not just a metadata field the model
        # never sees.
        prefixed = f"{current_section}\n{body}" if current_section else body
        chunks.append(Chunk(text=prefixed, metadata=meta))
        current, current_len = [], 0

    for units, section in blocks:
        # A heading change is a natural boundary — don't blend two sections.
        if section != current_section and current:
            emit()
        current_section = section

        for unit in units:
            unit = unit.strip()
            if not unit:
                continue

            if len(unit) > target_chars:
                if current:
                    emit()
                for part in _hard_split(unit, target_chars):
                    chunks.append(Chunk(
                        text=f"{section}\n{part}" if section else part,
                        metadata={**metadata, **({"section": section} if section else {})},
                    ))
                continue

            if current_len + len(unit) + 1 > target_chars and current:
                tail = _overlap_units(current, overlap_chars)
                emit()
                current = list(tail)
                current_len = sum(len(u) + 1 for u in current)

            current.append(unit)
            current_len += len(unit) + 1

    emit()

    return _merge_small(chunks, min_chars)


def _overlap_units(units: list[str], overlap_chars: int) -> list[str]:
    """Whole trailing units totalling <= overlap_chars — never a mid-word cut."""
    if overlap_chars <= 0:
        return []
    picked: list[str] = []
    total = 0
    for unit in reversed(units):
        if total + len(unit) > overlap_chars and picked:
            break
        picked.insert(0, unit)
        total += len(unit)
    return picked


def _merge_small(chunks: list[Chunk], min_chars: int) -> list[Chunk]:
    """Fold undersized chunks into their neighbour rather than indexing stubs."""
    if not chunks:
        return []
    merged: list[Chunk] = [chunks[0]]
    for chunk in chunks[1:]:
        prev = merged[-1]
        if len(chunk.text) < min_chars and prev.metadata.get("section") == chunk.metadata.get("section"):
            prev.text = f"{prev.text} {chunk.text}".strip()
        else:
            merged.append(chunk)
    # A lone stub with no neighbour to merge into is still worth keeping.
    return [c for c in merged if c.text.strip()]
