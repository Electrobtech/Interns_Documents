"""Knowledge RAG Auditor for the Support Agent — reasons over recent support
runs + the knowledge base to surface (a) coverage gaps: ticket categories the
RAG layer couldn't ground, and (b) per-source citation counts and staleness.
Pure aggregation, no LLM call. Powers the Coverage Gap Banner and the
"Cited in N replies" / "Verified vs Needs re-verification" chips."""
from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.knowledge_repo import KnowledgeRepository
from app.repositories.support_repo import SupportRepository
from app.schemas.support import (
    CoverageAuditOut, CoverageGap, SourceCitation,
)

# A knowledge source older than this (no re-verification) is flagged stale.
STALE_AFTER_DAYS = 30


class SupportAuditService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def coverage_audit(self, organization_id: uuid.UUID, run_limit: int = 200) -> CoverageAuditOut:
        runs = await SupportRepository(self._session).recent_runs(organization_id, limit=run_limit)
        sources = await KnowledgeRepository(self._session).list_sources(organization_id, "support")

        total = len(runs)
        grounded = 0
        cat_total: Counter[str] = Counter()
        cat_ungrounded: Counter[str] = Counter()
        citation_counts: dict[str, int] = defaultdict(int)

        for r in runs:
            used = r.knowledge_sources_used or []
            output = r.output or {}
            category = (output.get("ticket_category") or "uncategorized").strip().lower() or "uncategorized"

            cat_total[category] += 1
            if used:
                grounded += 1
                for sid in used:
                    citation_counts[str(sid)] += 1
            else:
                # RAG returned nothing usable for this reply → an evidence gap.
                cat_ungrounded[category] += 1

        # Build coverage gaps: categories where a meaningful share of replies were
        # ungrounded, ranked by ungrounded count then category volume.
        gaps: list[CoverageGap] = []
        for category, tickets in cat_total.items():
            ungrounded = cat_ungrounded.get(category, 0)
            if ungrounded == 0:
                continue
            gaps.append(CoverageGap(
                category=category,
                ticket_count=tickets,
                ungrounded_count=ungrounded,
                gap_pct=round(ungrounded / tickets * 100) if tickets else 0,
            ))
        gaps.sort(key=lambda g: (g.ungrounded_count, g.gap_pct), reverse=True)

        # Per-source citation counts + staleness.
        now = datetime.now(timezone.utc)
        citations: list[SourceCitation] = []
        stale_count = 0
        for s in sources:
            updated = s.updated_at or s.created_at
            if updated and updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            days = (now - updated).days if updated else 0
            is_stale = days >= STALE_AFTER_DAYS
            if is_stale:
                stale_count += 1
            citations.append(SourceCitation(
                source_id=s.id,
                name=s.name,
                source_type=s.source_type,
                cited_count=citation_counts.get(str(s.id), 0),
                days_since_updated=days,
                stale=is_stale,
            ))
        citations.sort(key=lambda c: c.cited_count, reverse=True)

        return CoverageAuditOut(
            total_runs_analyzed=total,
            grounded_pct=round(grounded / total * 100) if total else 0,
            gaps=gaps[:12],
            citations=citations,
            stale_source_count=stale_count,
        )
