"""Extract plain text (+ page/section metadata where available) from
uploaded documents and URLs.

Supported source_types:
  pdf   — PDF file bytes
  docx  — Word document bytes
  txt   — Plain text bytes
  csv   — CSV bytes
  md    — Markdown bytes (converted to plain text)
  note  — Short freeform text note (same as txt)
  web   — URL string passed as utf-8 encoded bytes; fetches and strips HTML
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass


@dataclass
class ExtractedPage:
    text: str
    metadata: dict


# ---------------------------------------------------------------------------
# Individual loaders
# ---------------------------------------------------------------------------

def load_pdf(data: bytes) -> list[ExtractedPage]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append(ExtractedPage(text=text, metadata={"page": i + 1}))
    return pages


def load_docx(data: bytes) -> list[ExtractedPage]:
    from docx import Document

    doc = Document(io.BytesIO(data))
    pages: list[ExtractedPage] = []
    current_heading: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            pages.append(ExtractedPage(text="\n".join(buffer), metadata={"heading": current_heading}))
            buffer.clear()

    for para in doc.paragraphs:
        if not para.text.strip():
            continue
        if para.style.name.startswith("Heading"):
            flush()
            current_heading = para.text
        else:
            buffer.append(para.text)
    flush()
    return pages or [ExtractedPage(text="", metadata={})]


def load_text(data: bytes) -> list[ExtractedPage]:
    return [ExtractedPage(text=data.decode("utf-8", errors="ignore"), metadata={})]


def load_csv(data: bytes) -> list[ExtractedPage]:
    text = data.decode("utf-8", errors="ignore")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return [ExtractedPage(text="", metadata={})]
    header, body = rows[0], rows[1:]
    lines = [", ".join(f"{h}: {v}" for h, v in zip(header, row)) for row in body]
    return [ExtractedPage(text="\n".join(lines), metadata={"rows": len(body)})]


def load_markdown(data: bytes) -> list[ExtractedPage]:
    """Convert Markdown to plain text by stripping HTML tags produced by the
    markdown renderer. Preserves heading structure as section metadata."""
    import markdown
    from bs4 import BeautifulSoup

    source = data.decode("utf-8", errors="ignore")
    html = markdown.markdown(source, extensions=["extra", "toc"])
    soup = BeautifulSoup(html, "html.parser")

    pages: list[ExtractedPage] = []
    current_heading: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        text = " ".join(buffer).strip()
        if text:
            pages.append(ExtractedPage(text=text, metadata={"heading": current_heading}))
        buffer.clear()

    for tag in soup.find_all(True):
        if tag.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            flush()
            current_heading = tag.get_text(separator=" ", strip=True)
        elif tag.name in ("p", "li", "td", "th", "blockquote", "pre", "code"):
            text = tag.get_text(separator=" ", strip=True)
            if text:
                buffer.append(text)

    flush()

    # Fallback: if no structured tags found, just strip all markup.
    if not pages:
        plain = re.sub(r"<[^>]+>", " ", html)
        plain = re.sub(r"\s+", " ", plain).strip()
        if plain:
            pages.append(ExtractedPage(text=plain, metadata={}))

    return pages or [ExtractedPage(text="", metadata={})]


def load_web(data: bytes) -> list[ExtractedPage]:
    """Fetch a URL and extract readable text from the HTML response.

    The URL is encoded as UTF-8 bytes so it can flow through the same
    ``bytes`` interface as every other loader. Fetch is done synchronously
    (called from an async context via run_in_executor if needed, but for
    simplicity we use httpx sync here since loaders are CPU-bound).
    """
    import httpx
    from bs4 import BeautifulSoup

    url = data.decode("utf-8", errors="ignore").strip()
    try:
        resp = httpx.get(url, timeout=20, follow_redirects=True,
                         headers={"User-Agent": "LeadAutomation-KnowledgeBot/1.0"})
        resp.raise_for_status()
        html = resp.text
    except httpx.HTTPError as exc:
        raise ValueError(f"Could not fetch URL {url!r}: {exc}") from exc

    soup = BeautifulSoup(html, "html.parser")

    # Remove boilerplate elements.
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]):
        tag.decompose()

    # Prefer <article> / <main>, fall back to <body>.
    content = soup.find("article") or soup.find("main") or soup.body or soup
    text = content.get_text(separator="\n", strip=True)  # type: ignore[union-attr]
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    title = soup.title.string.strip() if soup.title and soup.title.string else url
    return [ExtractedPage(text=text, metadata={"url": url, "title": title})]


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

LOADERS = {
    "pdf": load_pdf,
    "docx": load_docx,
    "txt": load_text,
    "note": load_text,
    "csv": load_csv,
    "md": load_markdown,
    "web": load_web,
}

SUPPORTED_EXTENSIONS = {
    "pdf": "pdf",
    "docx": "docx",
    "txt": "txt",
    "csv": "csv",
    "md": "md",
}


def extract(source_type: str, data: bytes) -> list[ExtractedPage]:
    loader = LOADERS.get(source_type)
    if not loader:
        raise ValueError(f"Unsupported source_type: {source_type!r}. "
                         f"Supported: {', '.join(LOADERS)}")
    return loader(data)
