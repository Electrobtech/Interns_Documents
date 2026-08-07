from __future__ import annotations

import calendar
import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.sales_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.agents.sales_followup_agent import SYSTEM_PROMPT as FOLLOWUP_SYSTEM_PROMPT
from app.agents.sales_followup_agent import build_user_prompt as build_followup_prompt
from app.agents.sales_followup_agent import validate_shape as validate_followup_shape
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.ml.lead_scoring_model import predict_fit_score
from app.repositories.handoff_repo import HandoffRepository
from app.repositories.sales_repo import SalesConfigRepository, SalesRepository
from app.schemas.sales import (
    CONFIDENCE_SIGNAL_KEYS,
    AgentProductivityLine,
    ConfidenceSignal,
    DraftFollowupIn,
    DraftFollowupOut,
    FollowupDraft,
    MonthlyRevenuePoint,
    RevenueGap,
    SalesAgentConfigOut,
    SalesAnalyticsOut,
    SalesComputedMetrics,
    SalesExportOut,
    SalesForecastOut,
    SalesQueueItem,
    SalesQueueOut,
    SalesRunIn,
    SalesRunOut,
    SignalBreakdown,
    StageForecast,
    WeeklyDealsPoint,
)
from app.services import service_client
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)

# Heuristic close-probability per pipeline stage — documented assumption,
# not a fabricated statistic: this platform doesn't yet track per-stage
# historical conversion rates (no stage-transition history table), so the
# weighted-pipeline forecast uses standard SaaS-pipeline heuristics until
# there's enough closed-deal history to derive real per-org rates. Swap for
# a query against real stage-transition outcomes the moment that data exists.
_STAGE_WIN_PROBABILITY = {"new": 0.10, "qualified": 0.30, "active": 0.60, "won": 1.0, "lost": 0.0}
_OPEN_STAGES = ("new", "qualified", "active")
_STAGE_LABEL = {"new": "New", "qualified": "Qualified", "active": "Active", "won": "Won", "lost": "Lost"}

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
            min_hot_score=row.min_hot_score if row else 75,
            max_followup_attempts=row.max_followup_attempts if row else 5,
            require_approval=row.require_approval if row else True,
            followup_cadence_days=list(row.followup_cadence_days) if row and row.followup_cadence_days else [1, 3, 7, 14],
            monthly_revenue_target=float(row.monthly_revenue_target) if row and row.monthly_revenue_target is not None else None,
            computed=computed,
            updated_at=row.updated_at if row else None,
        )

    async def update_config(
        self,
        organization_id: uuid.UUID,
        *,
        deal_value_field: str | None | object = ...,
        confidence_signals: list[ConfidenceSignal] | None | object = ...,
        min_hot_score: int | object = ...,
        max_followup_attempts: int | object = ...,
        require_approval: bool | object = ...,
        followup_cadence_days: list[int] | None | object = ...,
        monthly_revenue_target: float | None | object = ...,
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
            min_hot_score=min_hot_score,
            max_followup_attempts=max_followup_attempts,
            require_approval=require_approval,
            followup_cadence_days=followup_cadence_days,
            monthly_revenue_target=monthly_revenue_target,
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

    # ── Forecasting tab: pipeline-by-stage, monthly revenue, gap analysis ───

    @staticmethod
    def _lead_value(lead: dict, deal_value_field: str | None) -> float | None:
        if not deal_value_field:
            return None
        raw = lead.get(deal_value_field)
        if raw is None:
            return None
        try:
            return float(raw)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _lead_closed_month(lead: dict) -> str | None:
        """Leads have no dedicated `closed_at` column, so a won lead's
        `updated_at` (the last time its stage/score was written) is used as
        the close-date proxy — the same assumption noted in get_analytics's
        sales_cycle_days. Returns "YYYY-MM" or None if unparseable."""
        raw = lead.get("updated_at") or lead.get("created_at")
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            return f"{dt.year:04d}-{dt.month:02d}"
        except (ValueError, TypeError):
            return None

    async def get_forecast(self, organization_id: uuid.UUID) -> SalesForecastOut:
        config = await self._config_repo.get(organization_id)
        deal_value_field = config.deal_value_field if config else None
        target = float(config.monthly_revenue_target) if config and config.monthly_revenue_target is not None else None

        leads = await service_client.get_leads(organization_id) or []

        # ── Pipeline by stage ────────────────────────────────────────────
        by_stage: dict[str, list[dict]] = defaultdict(list)
        for lead in leads:
            stage = lead.get("stage") or "new"
            by_stage[stage].append(lead)

        pipeline: list[StageForecast] = []
        weighted_total = 0.0
        weighted_has_value = deal_value_field is not None
        for stage in ("new", "qualified", "active", "won", "lost"):
            rows = by_stage.get(stage, [])
            win_prob = _STAGE_WIN_PROBABILITY.get(stage, 0.0)
            if deal_value_field:
                values = [self._lead_value(l, deal_value_field) for l in rows]
                values = [v for v in values if v is not None]
                stage_value = round(sum(values), 2) if values else 0.0
                weighted_value = round(stage_value * win_prob, 2)
                if stage in _OPEN_STAGES:
                    weighted_total += weighted_value
            else:
                stage_value = None
                weighted_value = None
            pipeline.append(StageForecast(
                stage=stage, label=_STAGE_LABEL[stage], count=len(rows),
                value=stage_value, win_probability=win_prob, weighted_value=weighted_value,
            ))

        weighted_pipeline_value = round(weighted_total, 2) if weighted_has_value else None

        # ── Monthly revenue (last 6 months, won leads only) ─────────────
        won_leads = by_stage.get("won", [])
        month_totals: dict[str, float] = defaultdict(float)
        for lead in won_leads:
            month = self._lead_closed_month(lead)
            if not month:
                continue
            month_totals[month] += self._lead_value(lead, deal_value_field) or 0.0

        now = datetime.now(timezone.utc)
        months: list[MonthlyRevenuePoint] = []
        for i in range(5, -1, -1):
            year = now.year
            month_num = now.month - i
            while month_num <= 0:
                month_num += 12
                year -= 1
            key = f"{year:04d}-{month_num:02d}"
            months.append(MonthlyRevenuePoint(
                month=key, label=calendar.month_abbr[month_num],
                closed_value=round(month_totals.get(key, 0.0), 2),
            ))

        # ── Gap analysis: this month's target vs. actual closed revenue ──
        current_month_key = f"{now.year:04d}-{now.month:02d}"
        actual_mtd = month_totals.get(current_month_key, 0.0) if deal_value_field else None
        if target is None:
            gap = RevenueGap(target=None, actual_mtd=actual_mtd, gap=None, pct_of_target=None,
                              note="no monthly revenue target set yet")
        elif actual_mtd is None:
            gap = RevenueGap(target=target, actual_mtd=None, gap=None, pct_of_target=None,
                              note="target is set, but no deal-value field is mapped so actual revenue can't be computed")
        else:
            gap = RevenueGap(
                target=target, actual_mtd=round(actual_mtd, 2), gap=round(target - actual_mtd, 2),
                pct_of_target=round((actual_mtd / target) * 100, 1) if target > 0 else None,
                note=(f"{'ahead of' if actual_mtd >= target else 'behind'} target by "
                      f"${abs(round(target - actual_mtd, 2)):,.2f} this month"),
            )

        if weighted_pipeline_value is not None:
            open_count = sum(len(by_stage.get(s, [])) for s in _OPEN_STAGES)
            explanation = (
                f"Weighted pipeline value is ${weighted_pipeline_value:,.2f} across {open_count} open lead(s), "
                f"computed as each stage's summed '{deal_value_field}' times a heuristic win probability "
                f"(New 10%, Qualified 30%, Active 60% — see _STAGE_WIN_PROBABILITY). "
                + (gap.note if target is not None else "Set a monthly revenue target in Settings to see gap analysis.")
            )
        else:
            explanation = (
                "No deal-value field is mapped yet, so pipeline value can't be computed in dollars — "
                "stage counts above are real, but weighted revenue isn't shown rather than invented. "
                "Map a field via the Overview tab's 'Set Up Deal Values' CTA."
            )

        return SalesForecastOut(
            generated_at=now,
            deal_value_field=deal_value_field,
            pipeline_by_stage=pipeline,
            weighted_pipeline_value=weighted_pipeline_value,
            monthly_revenue=months,
            quarterly_prediction=weighted_pipeline_value,
            revenue_gap=gap,
            explanation=explanation,
        )

    # ── Analytics tab: MTD closed deals, avg deal size, cycle, productivity ─

    async def get_analytics(self, organization_id: uuid.UUID) -> SalesAnalyticsOut:
        config = await self._config_repo.get(organization_id)
        deal_value_field = config.deal_value_field if config else None

        leads = await service_client.get_leads(organization_id) or []
        won_leads = [l for l in leads if (l.get("stage") or "") == "won"]

        now = datetime.now(timezone.utc)
        cur_key = f"{now.year:04d}-{now.month:02d}"
        prev_month = now.month - 1 or 12
        prev_year = now.year if now.month > 1 else now.year - 1
        prev_key = f"{prev_year:04d}-{prev_month:02d}"

        mtd_count, prev_count = 0, 0
        deal_values: list[float] = []
        cycle_days: list[float] = []
        for lead in won_leads:
            month = self._lead_closed_month(lead)
            if month == cur_key:
                mtd_count += 1
            elif month == prev_key:
                prev_count += 1
            v = self._lead_value(lead, deal_value_field)
            if v is not None:
                deal_values.append(v)
            created, updated = lead.get("created_at"), lead.get("updated_at")
            if created and updated:
                try:
                    c = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                    u = datetime.fromisoformat(str(updated).replace("Z", "+00:00"))
                    days = (u - c).total_seconds() / 86400
                    if days >= 0:
                        cycle_days.append(days)
                except (ValueError, TypeError):
                    pass

        avg_deal_size = round(sum(deal_values) / len(deal_values), 2) if deal_values else None
        avg_deal_size_note = (
            f"averaged over {len(deal_values)} won lead(s) with '{deal_value_field}' set" if deal_values
            else ("no deal-value field mapped yet" if not deal_value_field else "no won leads have a deal value set yet")
        )

        sales_cycle_days = round(sum(cycle_days) / len(cycle_days), 1) if cycle_days else None
        sales_cycle_note = (
            "proxy metric: time between a lead's creation and its last CRM update on a won record "
            "(this platform doesn't track a dedicated stage-transition history yet)"
            if cycle_days else "not enough won leads with timestamps yet"
        )

        # ── Weekly deals won, last 6 ISO weeks ───────────────────────────
        week_totals: dict[str, int] = defaultdict(int)
        for lead in won_leads:
            raw = lead.get("updated_at") or lead.get("created_at")
            if not raw:
                continue
            try:
                dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                iso_year, iso_week, _ = dt.isocalendar()
                week_totals[f"{iso_year:04d}-W{iso_week:02d}"] += 1
            except (ValueError, TypeError):
                continue

        weekly: list[WeeklyDealsPoint] = []
        for i in range(5, -1, -1):
            dt = now - timedelta(weeks=i)
            iso_year, iso_week, _ = dt.isocalendar()
            key = f"{iso_year:04d}-W{iso_week:02d}"
            weekly.append(WeeklyDealsPoint(week=key, label=f"W{iso_week:02d}", count=week_totals.get(key, 0)))

        # ── Agent productivity, from real sales_agent_runs + handoffs ────
        runs = await self._repo.recent_runs(organization_id, limit=200)
        n_runs = len(runs)
        n_followups_drafted = sum(
            1 for r in runs if isinstance(r.output, dict) and (r.output.get("follow_up_message") or "").strip()
        )
        n_handoffs = sum(1 for r in runs if isinstance(r.output, dict) and r.output.get("human_handoff"))
        n_resolved = n_runs - n_handoffs

        productivity = [
            AgentProductivityLine(name="Lead scoring runs", count=n_runs),
            AgentProductivityLine(name="Follow-up drafts generated", count=n_followups_drafted),
            AgentProductivityLine(name="Resolved without handoff", count=max(0, n_resolved)),
            AgentProductivityLine(name="Sales handoffs", count=n_handoffs),
        ]
        ai_resolution_rate = round((n_resolved / n_runs) * 100, 1) if n_runs else None

        return SalesAnalyticsOut(
            generated_at=now,
            deals_closed_mtd=mtd_count,
            deals_closed_mtd_delta=(mtd_count - prev_count) if won_leads else None,
            avg_deal_size=avg_deal_size,
            avg_deal_size_note=avg_deal_size_note,
            sales_cycle_days=sales_cycle_days,
            sales_cycle_note=sales_cycle_note,
            weekly_deals_won=weekly,
            agent_productivity=productivity,
            ai_resolution_rate=ai_resolution_rate,
        )

    # ── Follow-up draft generation (Follow-ups tab "Regenerate") ────────────

    async def draft_followup(self, organization_id: uuid.UUID, body: DraftFollowupIn) -> DraftFollowupOut:
        lead_name, company, stage, score, channel = body.lead_name, body.company, body.stage, body.score, body.channel

        if body.lead_id:
            leads = await service_client.get_leads(organization_id) or []
            match = next((l for l in leads if str(l.get("id")) == str(body.lead_id)), None)
            if match:
                lead_name = lead_name or match.get("name")
                stage = stage or match.get("stage")
                score = score if score is not None else match.get("score")
                channel = channel or match.get("source")

        retriever = KnowledgeRetriever(self._session)
        query = f"follow-up outreach for {lead_name or 'a lead'} at {company or 'their company'}: {body.notes or ''}".strip()
        chunks, _low_confidence = await retriever.retrieve(organization_id, "sales", query, top_k=6)
        context = retriever.format_context(chunks)

        messages = [
            ChatMessage(role="system", content=FOLLOWUP_SYSTEM_PROMPT),
            ChatMessage(role="user", content=build_followup_prompt(
                context, lead_name, company, stage, score, channel, body.notes,
            )),
        ]

        provider = get_llm_provider()
        response = await provider.agenerate(messages, temperature=0.6, max_tokens=1200, json_mode=True)

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("sales_followup_json_parse_failed, wrapping raw text")
            data = {"email": {"subject": "", "body": response.content.strip()}}

        data = validate_followup_shape(data)
        source_ids = sorted({c.knowledge_source_id for c in chunks})

        return DraftFollowupOut(
            lead_name=lead_name,
            email=FollowupDraft(**data["email"]),
            whatsapp=FollowupDraft(**data["whatsapp"]),
            call_script=FollowupDraft(**data["call_script"]),
            knowledge_sources_used=source_ids,
        )
