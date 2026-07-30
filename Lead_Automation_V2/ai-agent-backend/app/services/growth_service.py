"""Growth expansion services for the Marketing Agent:

  • AeoService          — Answer Engine Optimization (persisted)
  • AntiBanService      — Meta/WhatsApp deliverability pre-flight (stateless)
  • CtwaService         — Click-to-WhatsApp ad package (persisted)
  • ColdRevivalService  — Cold Lead Revival Radar (reads live leads, stateless)

Each follows the established SEO/persona pattern: RAG-ground → LLM (json_mode)
→ validate_shape → (persist if it's a saved artifact) → return schema.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import aeo_agent, antiban_agent, cold_revival_agent, ctwa_agent
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.marketing_extras_repo import AeoRepository, CtwaRepository
from app.schemas.marketing_extras import (
    AeoOut, AntiBanOut, ColdRevivalOut, CtwaOut, DormantLeadOut,
)
from app.services._llm_helper import generate_logged
from app.services.service_client import get_contacts, get_leads

logger = logging.getLogger(__name__)


def _parse_json(content: str, log_key: str) -> dict:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.warning("%s_json_parse_failed, using empty shape", log_key)
        return {}


# ---------------------------------------------------------------------------
# AEO — Answer Engine Optimization
# ---------------------------------------------------------------------------


class AeoService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = AeoRepository(session)

    async def optimize(self, organization_id: uuid.UUID, copy: str) -> AeoOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, _ = await retriever.retrieve(organization_id, "marketing", copy, top_k=6)
        context = retriever.format_context(chunks)

        messages = [
            ChatMessage(role="system", content=aeo_agent.SYSTEM_PROMPT),
            ChatMessage(role="user", content=aeo_agent.build_user_prompt(copy, context)),
        ]
        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
        )
        data = aeo_agent.validate_shape(_parse_json(response.content, "aeo_agent"))

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        row = await self._repo.save(organization_id, copy, {**data, "knowledge_sources_used": source_ids})
        await self._session.commit()

        return AeoOut(id=row.id, input_text=copy, created_at=row.created_at, knowledge_sources_used=source_ids, **data)

    async def list_recent(self, organization_id: uuid.UUID):
        return await self._repo.recent(organization_id)


# ---------------------------------------------------------------------------
# Anti-Ban — deliverability pre-flight (stateless)
# ---------------------------------------------------------------------------


class AntiBanService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def check(
        self, organization_id: uuid.UUID, draft: str, channel: str, recent_sends_note: str | None,
    ) -> AntiBanOut:
        messages = [
            ChatMessage(role="system", content=antiban_agent.SYSTEM_PROMPT),
            ChatMessage(role="user", content=antiban_agent.build_user_prompt(draft, channel, recent_sends_note)),
        ]
        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
            temperature=0.2,  # a compliance check should be steady, not creative
        )
        data = antiban_agent.validate_shape(_parse_json(response.content, "antiban_agent"))
        # No DB write — but commit so the provider-usage log row from
        # generate_logged is persisted.
        await self._session.commit()
        return AntiBanOut(**data)


# ---------------------------------------------------------------------------
# Click-to-WhatsApp ad package
# ---------------------------------------------------------------------------


class CtwaService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = CtwaRepository(session)

    async def generate(self, organization_id: uuid.UUID, offer_brief: str) -> CtwaOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, _ = await retriever.retrieve(organization_id, "marketing", offer_brief, top_k=6)
        context = retriever.format_context(chunks)

        messages = [
            ChatMessage(role="system", content=ctwa_agent.SYSTEM_PROMPT),
            ChatMessage(role="user", content=ctwa_agent.build_user_prompt(offer_brief, context)),
        ]
        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
        )
        data = ctwa_agent.validate_shape(_parse_json(response.content, "ctwa_agent"))

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        row = await self._repo.save(organization_id, offer_brief, {**data, "knowledge_sources_used": source_ids})
        await self._session.commit()

        return CtwaOut(id=row.id, offer_brief=offer_brief, created_at=row.created_at, knowledge_sources_used=source_ids, **data)

    async def list_recent(self, organization_id: uuid.UUID):
        return await self._repo.recent(organization_id)


# ---------------------------------------------------------------------------
# Cold Lead Revival Radar
# ---------------------------------------------------------------------------


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        # Handle ISO strings, with or without trailing Z.
        s = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _last_touch(record: dict) -> datetime | None:
    # Prefer the most recent real activity signal; fall back to created_at.
    for field in ("last_activity_at", "last_message_at", "last_contacted_at", "updated_at", "created_at"):
        dt = _parse_dt(record.get(field))
        if dt:
            return dt
    return None


class ColdRevivalService:
    """Detects dormant leads client-side (no LLM cost to find them), then asks
    the LLM to design a 3-step re-engagement drip only for the dormant segment."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def scan(
        self, organization_id: uuid.UUID, dormant_days: int, note: str | None,
    ) -> ColdRevivalOut:
        # Prefer leads; fall back to contacts if the leads endpoint is unavailable.
        records = await get_leads(organization_id) or await get_contacts(organization_id) or []

        now = datetime.now(timezone.utc)
        dormant: list[DormantLeadOut] = []
        for r in records:
            touched = _last_touch(r)
            if not touched:
                continue
            days = (now - touched).days
            if days >= dormant_days:
                dormant.append(DormantLeadOut(
                    name=str(r.get("name") or r.get("contact_name") or "Unknown"),
                    source=str(r.get("source") or r.get("channel") or "unknown"),
                    days_inactive=days,
                ))
        dormant.sort(key=lambda d: d.days_inactive, reverse=True)

        # If nothing is dormant, return early — no LLM call needed.
        if not dormant:
            return ColdRevivalOut(
                dormant_count=0, dormant_days=dormant_days, dormant_leads=[],
                revival_summary="No dormant leads found for this window — everyone has been active recently.",
            )

        # Build a compact, PII-light summary for the prompt.
        from collections import Counter
        source_counts = Counter(d.source for d in dormant)
        oldest = max(d.days_inactive for d in dormant)
        dormant_summary = (
            f"{len(dormant)} leads inactive for >= {dormant_days} days "
            f"(oldest {oldest} days). By source: "
            + ", ".join(f"{src}: {n}" for src, n in source_counts.most_common())
        )

        retriever = KnowledgeRetriever(self._session)
        chunks, _ = await retriever.retrieve(
            organization_id, "marketing", "re-engagement offer reason to return", top_k=5,
        )
        context = retriever.format_context(chunks)

        messages = [
            ChatMessage(role="system", content=cold_revival_agent.SYSTEM_PROMPT),
            ChatMessage(role="user", content=cold_revival_agent.build_user_prompt(dormant_summary, context, note)),
        ]
        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
        )
        data = cold_revival_agent.validate_shape(_parse_json(response.content, "cold_revival_agent"))
        source_ids = sorted({c.knowledge_source_id for c in chunks})
        await self._session.commit()

        return ColdRevivalOut(
            dormant_count=len(dormant),
            dormant_days=dormant_days,
            dormant_leads=dormant[:25],  # cap the list returned to the UI
            knowledge_sources_used=source_ids,
            **data,
        )
