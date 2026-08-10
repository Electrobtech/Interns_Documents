"""Memory manager — the unified read/write facade (§14).

Assembles a *budgeted* context on every turn. The priority order is fixed so
truncation is deterministic rather than arbitrary: when the budget runs out, the
same things get dropped every time, and that is reproducible in a trace.

Tenant safety: memory is the highest-risk surface for cross-tenant leakage
because it flows straight into prompts. Every query filters org_id, and RLS
enforces it at the database regardless.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from redis.asyncio import Redis
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_ai.client import LLMClient
from orbq_contracts.agent import AgentContext
from orbq_core.tenancy import current_tenant

from ..models.memory import MemoryRecord

log = structlog.get_logger()

SHORT_TERM_TTL_SECONDS = 86_400  # 24h
SHORT_TERM_MAX_TURNS = 12


class MemoryManager:
    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        llm: LLMClient,
        *,
        max_long_term: int = 6,
        max_entity: int = 8,
    ) -> None:
        self.db = session
        self.redis = redis
        self.llm = llm
        self.max_long_term = max_long_term
        self.max_entity = max_entity

    # -- keys ---------------------------------------------------------------

    @staticmethod
    def _short_term_key(org_id: uuid.UUID, session_id: uuid.UUID) -> str:
        # Org-prefixed per §17.3 — no unprefixed Redis keys are permitted.
        return f"orbq:ai-agents:{org_id}:session:{session_id}:turns"

    # -- read ---------------------------------------------------------------

    async def load(
        self, *, workspace: str, session_id: uuid.UUID, context: AgentContext
    ) -> dict:
        ctx = current_tenant()

        short_term = await self._load_short_term(ctx.org_id, session_id)
        entity = await self._load_entity(context)
        long_term = await self._load_long_term(workspace)

        return {
            "short_term": short_term,
            "entity": entity,
            "long_term": long_term,
        }

    async def _load_short_term(self, org_id: uuid.UUID, session_id: uuid.UUID) -> list[dict]:
        try:
            raw = await self.redis.lrange(
                self._short_term_key(org_id, session_id), 0, SHORT_TERM_MAX_TURNS - 1
            )
            return [json.loads(item) for item in raw]
        except Exception as exc:  # noqa: BLE001
            # Short-term memory is a convenience, not correctness. A Redis blip
            # should cost continuity, not the whole request.
            log.warning("short_term_memory_unavailable", error=str(exc))
            return []

    async def _load_entity(self, context: AgentContext) -> list[dict]:
        """Memory attached to the entities this request is about."""
        subjects: list[tuple[str, uuid.UUID]] = []
        if context.lead_id:
            subjects.append(("lead", context.lead_id))
        if context.campaign_id:
            subjects.append(("campaign", context.campaign_id))
        if context.conversation_id:
            subjects.append(("conversation", context.conversation_id))
        subjects.extend(("contact", cid) for cid in context.contact_ids[:5])

        if not subjects:
            return []

        ctx = current_tenant()
        now = datetime.now(timezone.utc)
        conditions = [
            (MemoryRecord.subject_type == stype) & (MemoryRecord.subject_id == sid)
            for stype, sid in subjects
        ]

        stmt = (
            select(MemoryRecord)
            .where(
                MemoryRecord.org_id == ctx.org_id,
                MemoryRecord.deleted_at.is_(None),
                MemoryRecord.superseded_by.is_(None),
                # TTL enforced here, not only by the sweeper.
                or_(MemoryRecord.expires_at.is_(None), MemoryRecord.expires_at > now),
                or_(*conditions),
            )
            .order_by(MemoryRecord.importance.desc(), MemoryRecord.created_at.desc())
            .limit(self.max_entity)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [self._serialize(r) for r in rows]

    async def _load_long_term(self, workspace: str) -> list[dict]:
        ctx = current_tenant()
        now = datetime.now(timezone.utc)
        stmt = (
            select(MemoryRecord)
            .where(
                MemoryRecord.org_id == ctx.org_id,
                MemoryRecord.deleted_at.is_(None),
                MemoryRecord.superseded_by.is_(None),
                or_(MemoryRecord.expires_at.is_(None), MemoryRecord.expires_at > now),
                or_(MemoryRecord.workspace == workspace, MemoryRecord.workspace.is_(None)),
                MemoryRecord.kind.in_(("preference", "constraint", "correction")),
            )
            .order_by(MemoryRecord.importance.desc(), MemoryRecord.confidence.desc())
            .limit(self.max_long_term)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [self._serialize(r) for r in rows]

    async def recall_semantic(
        self, query: str, *, workspace: str, top_k: int = 5
    ) -> list[dict]:
        """Similarity recall — memories relevant by meaning, not recency."""
        ctx = current_tenant()
        try:
            vec = (await self.llm.embed([query]))[0]
        except Exception as exc:  # noqa: BLE001
            log.warning("semantic_recall_unavailable", error=str(exc))
            return []

        rows = (
            await self.db.execute(
                text(
                    """
                    SELECT id, kind, content, confidence, importance, subject_type,
                           1 - (embedding <=> CAST(:vec AS vector)) AS similarity
                    FROM memory_records
                    WHERE org_id = CAST(:org_id AS uuid)
                      AND deleted_at IS NULL
                      AND superseded_by IS NULL
                      AND embedding IS NOT NULL
                      AND (workspace = :workspace OR workspace IS NULL)
                      AND (expires_at IS NULL OR expires_at > now())
                    ORDER BY embedding <=> CAST(:vec AS vector)
                    LIMIT :k
                    """
                ),
                {"vec": str(vec), "org_id": str(ctx.org_id), "workspace": workspace, "k": top_k},
            )
        ).mappings().all()

        return [dict(r) | {"id": str(r["id"])} for r in rows]

    # -- write --------------------------------------------------------------

    async def append_turn(
        self, session_id: uuid.UUID, *, role: str, content: str
    ) -> None:
        ctx = current_tenant()
        key = self._short_term_key(ctx.org_id, session_id)
        try:
            pipe = self.redis.pipeline()
            pipe.lpush(key, json.dumps({"role": role, "content": content[:2000]}))
            pipe.ltrim(key, 0, SHORT_TERM_MAX_TURNS - 1)
            pipe.expire(key, SHORT_TERM_TTL_SECONDS)
            await pipe.execute()
        except Exception as exc:  # noqa: BLE001
            log.warning("short_term_write_failed", error=str(exc))

    async def remember(
        self,
        content: str,
        *,
        kind: str = "fact",
        workspace: str | None = None,
        subject_type: str = "org",
        subject_id: uuid.UUID | None = None,
        importance: float = 0.5,
        confidence: float = 0.7,
        ttl_days: int | None = None,
        source_execution_id: uuid.UUID | None = None,
    ) -> MemoryRecord:
        ctx = current_tenant()
        try:
            embedding = (await self.llm.embed([content]))[0]
        except Exception:  # noqa: BLE001
            # Store it anyway — a memory without an embedding is still
            # retrievable by subject, just not semantically.
            embedding = None

        record = MemoryRecord(
            org_id=ctx.org_id,
            created_by=ctx.user_id,
            workspace=workspace,
            kind=kind,
            subject_type=subject_type,
            subject_id=subject_id,
            content=content,
            embedding=embedding,
            importance=importance,
            confidence=confidence,
            expires_at=(
                datetime.now(timezone.utc) + timedelta(days=ttl_days) if ttl_days else None
            ),
            source_execution_id=source_execution_id,
        )
        self.db.add(record)
        await self.db.flush()
        return record

    @staticmethod
    def _serialize(record: MemoryRecord) -> dict:
        return {
            "id": str(record.id),
            "kind": record.kind,
            "content": record.content,
            "subject_type": record.subject_type,
            "confidence": record.confidence,
            "importance": record.importance,
        }

    @staticmethod
    def to_prompt_text(memory: dict, *, max_chars: int = 1500) -> str:
        """Flatten for prompt injection, newest-first, budget-capped.

        Labeled as background context so the model treats it as reference, not
        instruction — same boundary as retrieved knowledge (§18.4).
        """
        lines: list[str] = []
        used = 0
        for bucket in ("entity", "long_term"):
            for item in memory.get(bucket, []):
                line = f"- ({item['kind']}) {item['content']}"
                if used + len(line) > max_chars:
                    return "\n".join(lines)
                lines.append(line)
                used += len(line)

        for turn in memory.get("short_term", [])[:6]:
            line = f"- {turn['role']}: {turn['content'][:300]}"
            if used + len(line) > max_chars:
                break
            lines.append(line)
            used += len(line)

        return "\n".join(lines)
