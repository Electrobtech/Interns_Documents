from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.sales_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.ml.lead_scoring_model import predict_fit_score
from app.repositories.handoff_repo import HandoffRepository
from app.repositories.sales_repo import SalesConfigRepository, SalesRepository
from app.schemas.sales import (
    CONFIDENCE_SIGNAL_KEYS,
    ConfidenceSignal,
    SalesAgentConfigOut,
    SalesComputedMetrics,
    SalesExportOut,
    SalesQueueItem,
    SalesQueueOut,
    SalesRunIn,
    SalesRunOut,
    SignalBreakdown,
)
from app.services import service_client
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)

_SIGNAL_LABELS = {
    "lead_score_avg": "Avg. lead fit score (recent runs)",
    "knowledge_coverage": "RAG-grounded runs (vs. ungrounded guesses)",
    "handoff_rate": "Runs resolved without a human handoff",
}

_DEFAULT_SIGNALS = [
    ConfidenceSignal(key=k, enabled=False, weight=1.0) for k in CONFIDENCE_SIGNAL_KEYS
]


class SalesService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = SalesRepository(session)
        self._config_repo = SalesConfigRepository(session)

    async def run(self, organization_id: uuid.UUID, body: SalesRunIn) -> SalesRunOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, low_confidence = await retriever.retrieve(
            organization_id, "sales", body.brief, top_k=6
        )
        context = retriever.format_context(chunks)

        # Hybrid scoring: when the structured fit signals are available, the
        # random forest computes the number and the LLM reasons about *that*
        # number rather than guessing its own. Falls back to pure LLM
        # scoring (model_score=None) when org_size/budget/channel weren't
        # supplied — e.g. a free-text-only brief with no structured lead data.
        model_score = None
        if body.org_size or body.budget or body.channel:
            model_score = predict_fit_score(body.org_size, body.budget, body.channel)["score"]

        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(
                role="user",
                content=build_user_prompt(
                    body.brief, context, body.lead_name, body.company,
                    body.existing_score, body.stage, model_score,
                ),
            ),
        ]

        provider = get_llm_provider()
        response = await provider.agenerate(
            messages, temperature=0.5, max_tokens=1200, json_mode=True
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("sales_agent_json_parse_failed, wrapping raw text")
            data = {"recommended_sales_action": response.content.strip()}

        data = validate_shape(data)

        # Belt and suspenders: instruct the LLM to use the model score
        # verbatim (see SYSTEM_PROMPT), but don't rely on instruction-
        # following alone for a number that's supposed to be authoritative.
        if model_score is not None:
            data["lead_score"] = model_score

        if low_confidence and not data.get("follow_up_questions"):
            data["follow_up_questions"] = [
                "Could you share more detail or upload relevant sales/product documents? "
                "I didn't find strong matches in the knowledge base for this brief."
            ]

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        await self._repo.save_run(organization_id, body.brief, data, source_ids)

        # Create a HandoffRequest when the sales agent flags a human handoff.
        if data.get("human_handoff"):
            await HandoffRepository(self._session).create(
                organization_id=organization_id,
                agent_type="sales",
                original_brief=body.brief,
                agent_output=data,
                customer_name=body.lead_name,
            )

        await self._session.commit()

        await WebhookService(self._session).dispatch(
            organization_id,
            "run.completed",
            {"agent_type": "sales", "brief": body.brief, "output": data},
        )

        return SalesRunOut(**data, knowledge_sources_used=source_ids)

    # ── Config: deal-value mapping + confidence signal weights ──────────────

    async def get_config(self, organization_id: uuid.UUID) -> SalesAgentConfigOut:
        row = await self._config_repo.get(organization_id)
        deal_value_field = row.deal_value_field if row else None
        signals = self._signals_from_row(row)
        computed = await self._compute_metrics(organization_id, deal_value_field, signals)
        return SalesAgentConfigOut(
            deal_value_field=deal_value_field,
            confidence_signals=signals,
            computed=computed,
            updated_at=row.updated_at if row else None,
        )

    async def update_config(
        self,
        organization_id: uuid.UUID,
        *,
        deal_value_field: str | None | object = ...,
        confidence_signals: list[ConfidenceSignal] | None | object = ...,
    ) -> SalesAgentConfigOut:
        signal_dicts = ...
        if confidence_signals is not ...:
            signal_dicts = (
                {"signals": [s.model_dump() for s in confidence_signals]}
                if confidence_signals is not None
                else {}
            )
        row = await self._config_repo.upsert(
            organization_id,
            deal_value_field=deal_value_field,
            confidence_signal_config=signal_dicts,
        )
        await self._session.commit()
        return await self.get_config(organization_id)

    def _signals_from_row(self, row) -> list[ConfidenceSignal]:
        raw = (row.confidence_signal_config or {}).get("signals") if row else None
        if not raw:
            return list(_DEFAULT_SIGNALS)
        by_key = {s["key"]: s for s in raw if s.get("key") in CONFIDENCE_SIGNAL_KEYS}
        return [
            ConfidenceSignal(**by_key[k]) if k in by_key else ConfidenceSignal(key=k, enabled=False, weight=1.0)
            for k in CONFIDENCE_SIGNAL_KEYS
        ]

    async def _compute_metrics(
        self, organization_id: uuid.UUID, deal_value_field: str | None, signals: list[ConfidenceSignal],
    ) -> SalesComputedMetrics:
        metrics = SalesComputedMetrics()

        # ── Pipeline Value ───────────────────────────────────────────────
        if deal_value_field:
            leads = await service_client.get_leads(organization_id)
            if leads is None:
                metrics.pipeline_value_note = "CRM temporarily unreachable — try again shortly"
            else:
                total = 0.0
                count = 0
                for lead in leads:
                    raw = lead.get(deal_value_field)
                    if raw is None:
                        continue
                    try:
                        total += float(raw)
                        count += 1
                    except (TypeError, ValueError):
                        continue
                if count:
                    metrics.pipeline_value = round(total, 2)
                    metrics.leads_with_deal_value = count
                    metrics.pipeline_value_note = f"sum of '{deal_value_field}' across {count} lead(s)"
                else:
                    metrics.pipeline_value_note = f"'{deal_value_field}' is mapped, but no leads have it set yet"
        # else: leave the default "no deal-value field mapped yet" note.

        # ── AI Confidence ────────────────────────────────────────────────
        enabled = [s for s in signals if s.enabled and s.weight > 0]
        if not enabled:
            return metrics

        runs = await self._repo.recent_runs(organization_id, limit=50)
        if not runs:
            metrics.ai_confidence_note = "confidence signals are wired, but there are no agent runs yet to measure"
            metrics.signal_breakdown = [
                SignalBreakdown(key=s.key, label=_SIGNAL_LABELS.get(s.key, s.key), enabled=s.enabled, weight=s.weight, note="no runs yet")
                for s in signals
            ]
            return metrics

        n = len(runs)
        scored = [r.output.get("lead_score") for r in runs if isinstance(r.output, dict) and r.output.get("lead_score") is not None]
        lead_score_avg = (sum(scored) / len(scored)) if scored else None

        grounded = sum(1 for r in runs if r.knowledge_sources_used)
        knowledge_coverage = (grounded / n) * 100

        handed_off = sum(1 for r in runs if isinstance(r.output, dict) and r.output.get("human_handoff"))
        handoff_rate = ((n - handed_off) / n) * 100

        values = {
            "lead_score_avg": lead_score_avg,
            "knowledge_coverage": knowledge_coverage,
            "handoff_rate": handoff_rate,
        }

        breakdown: list[SignalBreakdown] = []
        weighted_sum = 0.0
        weight_total = 0.0
        for s in signals:
            value = values.get(s.key)
            note = None
            if s.enabled and s.weight > 0:
                if value is None:
                    note = "no data for this signal yet"
                else:
                    weighted_sum += value * s.weight
                    weight_total += s.weight
            breakdown.append(SignalBreakdown(
                key=s.key, label=_SIGNAL_LABELS.get(s.key, s.key),
                enabled=s.enabled, weight=s.weight,
                value=round(value, 1) if value is not None else None,
                note=note,
            ))

        metrics.signal_breakdown = breakdown
        if weight_total > 0:
            metrics.ai_confidence = round(weighted_sum / weight_total)
            metrics.ai_confidence_note = f"weighted across {sum(1 for s in signals if s.enabled and s.weight > 0 and values.get(s.key) is not None)} signal(s), {n} run(s) sampled"
        else:
            metrics.ai_confidence_note = "signals enabled, but none have data yet"

        return metrics

    # ── Task queue (replaces the hardcoded header badge) ────────────────────

    async def get_queue(self, organization_id: uuid.UUID) -> SalesQueueOut:
        items: list[SalesQueueItem] = []

        overdue = await service_client.get_follow_ups(organization_id, bucket="overdue") or []
        today = await service_client.get_follow_ups(organization_id, bucket="today") or []
        for f in overdue:
            items.append(SalesQueueItem(
                id=str(f.get("id")), type="follow_up",
                title=f"Follow up: {f.get('contact_name') or 'Unnamed contact'}",
                sub=f.get("notes") or "Overdue", priority="high",
                due_at=f.get("due_at"),
            ))
        for f in today:
            items.append(SalesQueueItem(
                id=str(f.get("id")), type="follow_up",
                title=f"Follow up: {f.get('contact_name') or 'Unnamed contact'}",
                sub=f.get("notes") or "Due today",
                due_at=f.get("due_at"),
            ))

        pending_handoffs = await HandoffRepository(self._session).list_for_org(
            organization_id, status="pending", agent_type="sales", limit=100,
        )
        for h in pending_handoffs:
            items.append(SalesQueueItem(
                id=str(h.id), type="handoff",
                title=f"{h.customer_name or 'Unnamed lead'} — human handoff requested",
                sub="Awaiting a rep", priority="high",
                due_at=h.created_at,
            ))

        return SalesQueueOut(total=len(items), items=items, generated_at=datetime.now(timezone.utc))

    # ── Export ───────────────────────────────────────────────────────────────

    async def get_export(self, organization_id: uuid.UUID) -> SalesExportOut:
        config = await self._config_repo.get(organization_id)
        deal_value_field = config.deal_value_field if config else None

        leads = await service_client.get_leads(organization_id) or []
        by_stage: dict[str, int] = {}
        total_value = 0.0
        valued_count = 0
        for lead in leads:
            stage = lead.get("stage") or "unknown"
            by_stage[stage] = by_stage.get(stage, 0) + 1
            if deal_value_field:
                raw = lead.get(deal_value_field)
                if raw is not None:
                    try:
                        total_value += float(raw)
                        valued_count += 1
                    except (TypeError, ValueError):
                        pass

        summary = {
            "total_leads": len(leads),
            "by_stage": by_stage,
            "deal_value_field": deal_value_field,
            "total_pipeline_value": round(total_value, 2) if deal_value_field else None,
            "leads_with_deal_value": valued_count,
        }
        return SalesExportOut(
            generated_at=datetime.now(timezone.utc),
            organization_id=organization_id,
            summary=summary,
            leads=leads,
        )
