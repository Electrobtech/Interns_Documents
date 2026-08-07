"""The AI Orchestrator — Phase 5. The brain.

Owns the public contract, the session, the plan, and the response. Computes
nothing itself: every capability runs in one of the three agent services.

The central design decision here is §10.3 — **no distributed transactions on the
hot path**. The orchestrator writes session + execution to its own database in
one local transaction, assembles the response in memory, and returns. Trace
persistence, audit, and memory write-back happen after the response via events.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_contracts.agent import (
    ApprovalRef,
    AgentRequest,
    AgentResponse,
    Explanation,
    ExecutionStatus,
    KnowledgeCitation,
    UsageStats,
    Workspace,
)
from orbq_contracts.capability import CapabilityContext, CapabilityResult
from orbq_core.tenancy import current_tenant

from ..clients.agent_client import AgentServiceClient
from ..memory.manager import MemoryManager
from ..models.agent import AgentExecution, AgentSession, CapabilityInvocation
from ..rag.retriever import KnowledgeRetriever
from .planner import ExecutionPlan, Planner
from .registry import CapabilityRegistry

log = structlog.get_logger()


class Orchestrator:
    def __init__(
        self,
        session: AsyncSession,
        *,
        registry: CapabilityRegistry,
        planner: Planner,
        retriever: KnowledgeRetriever,
        memory: MemoryManager,
        agent_client: AgentServiceClient,
    ) -> None:
        self.db = session
        self.registry = registry
        self.planner = planner
        self.retriever = retriever
        self.memory = memory
        self.agent_client = agent_client

    async def execute(self, workspace: Workspace, request: AgentRequest) -> AgentResponse:
        ctx = current_tenant()
        started = time.perf_counter()

        session = await self._resolve_session(workspace, request)
        execution = await self._open_execution(session, workspace, request)

        degraded: list[str] = []

        # ---- gather context (memory + knowledge), tolerating failures -------
        memory_ctx = await self._safe(
            self.memory.load(workspace=workspace, session_id=session.id, context=request.context),
            fallback={},
            label="memory",
            degraded=degraded,
        )

        retrieval = await self._safe(
            self.retriever.retrieve(request.message, workspace=workspace.value, top_k=6),
            fallback=None,
            label="knowledge",
            degraded=degraded,
        )

        citations: list[KnowledgeCitation] = []
        knowledge_text = ""
        if retrieval is not None:
            knowledge_text = retrieval.as_text()
            citations = [
                KnowledgeCitation(
                    source_id=c.source_id,
                    source_title=c.source_title,
                    chunk_id=c.chunk_id,
                    score=round(c.cosine, 4),
                    excerpt=c.content[:280],
                )
                for c in retrieval.chunks
            ]
            if retrieval.low_confidence:
                # Surfaced, not hidden: a capability answering ungrounded must
                # say so rather than fabricate a citation (§10.7).
                degraded.append("knowledge:low_confidence")

        # ---- plan ----------------------------------------------------------
        plan = await self.planner.plan(
            workspace=workspace,
            message=request.message,
            context=request.context,
            memory=memory_ctx,
            max_capabilities=request.max_capabilities,
        )

        # ---- execute the DAG, stage by stage -------------------------------
        results: dict[str, CapabilityResult] = {}
        for stage_index, stage in enumerate(plan.stages):
            cap_ctx_base = CapabilityContext(
                org_id=ctx.org_id,
                user_id=ctx.user_id,
                workspace=workspace,
                session_id=session.id,
                execution_id=execution.id,
                message=request.message,
                context=request.context,
                knowledge=citations,
                knowledge_text=knowledge_text,
                memory=memory_ctx,
                upstream={k: v.output for k, v in results.items()},
                degraded_inputs=list(degraded),
            )

            # Capabilities within a stage have no interdependencies, so they run
            # concurrently. Across three services this is real parallelism.
            stage_results = await asyncio.gather(
                *(self.agent_client.invoke(workspace, name, cap_ctx_base) for name in stage),
                return_exceptions=True,
            )

            for name, outcome in zip(stage, stage_results, strict=True):
                if isinstance(outcome, BaseException):
                    log.warning("capability_failed", capability=name, error=str(outcome))
                    results[name] = CapabilityResult(
                        capability=name, output={}, confidence=0.0,
                        error=str(outcome)[:500],
                    )
                else:
                    results[name] = outcome
                await self._record_invocation(execution, results[name], stage_index)

        return await self._assemble(
            session=session,
            execution=execution,
            plan=plan,
            results=results,
            citations=citations,
            degraded=degraded,
            started=started,
        )

    # ------------------------------------------------------------------ utils

    async def _safe(self, coro, *, fallback, label: str, degraded: list[str]):
        """Run a dependency call, degrading loudly instead of failing the run.

        An agent that answers confidently on missing context is worse than one
        that admits what it could not reach (§7.4).
        """
        try:
            return await coro
        except Exception as exc:  # noqa: BLE001
            log.warning("dependency_degraded", dependency=label, error=str(exc))
            degraded.append(f"{label}:unavailable")
            return fallback

    async def _resolve_session(
        self, workspace: Workspace, request: AgentRequest
    ) -> AgentSession:
        ctx = current_tenant()
        if request.session_id:
            existing = await self.db.get(AgentSession, request.session_id)
            # Tenant check is belt-and-braces: RLS already prevents the fetch,
            # but an explicit comparison makes the intent auditable.
            if existing and existing.org_id == ctx.org_id and existing.status == "open":
                existing.turn_count += 1
                existing.last_activity_at = datetime.now(timezone.utc)
                return existing

        session = AgentSession(
            org_id=ctx.org_id,
            created_by=ctx.user_id,
            workspace=workspace.value,
            title=request.message[:120],
            status="open",
            turn_count=1,
            last_activity_at=datetime.now(timezone.utc),
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def _open_execution(
        self, session: AgentSession, workspace: Workspace, request: AgentRequest
    ) -> AgentExecution:
        ctx = current_tenant()
        execution = AgentExecution(
            org_id=ctx.org_id,
            created_by=ctx.user_id,
            session_id=session.id,
            workspace=workspace.value,
            status="running",
            request_message=request.message,
            request_context=request.context.model_dump(mode="json"),
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(execution)
        await self.db.flush()
        return execution

    async def _record_invocation(
        self, execution: AgentExecution, result: CapabilityResult, stage: int
    ) -> None:
        ctx = current_tenant()
        self.db.add(
            CapabilityInvocation(
                org_id=ctx.org_id,
                execution_id=execution.id,
                capability=result.capability,
                workspace=execution.workspace,
                stage=stage,
                status="failed" if result.error else "succeeded",
                output=result.output,
                reasoning=result.reasoning,
                confidence=result.confidence,
                citations=[c.model_dump(mode="json") for c in result.citations],
                tokens_in=result.tokens_in,
                tokens_out=result.tokens_out,
                duration_ms=result.duration_ms,
                prompt_version=result.prompt_version,
                model=result.model,
                error_detail=result.error,
            )
        )

    async def _assemble(
        self,
        *,
        session: AgentSession,
        execution: AgentExecution,
        plan: ExecutionPlan,
        results: dict[str, CapabilityResult],
        citations: list[KnowledgeCitation],
        degraded: list[str],
        started: float,
    ) -> AgentResponse:
        succeeded = [r for r in results.values() if not r.error]
        failed = [r for r in results.values() if r.error]

        if not results:
            status = ExecutionStatus.FAILED
        elif failed and succeeded:
            status = ExecutionStatus.PARTIAL
        elif failed:
            status = ExecutionStatus.FAILED
        else:
            status = ExecutionStatus.SUCCEEDED

        # Aggregate confidence is the weakest link, not the average: a plan is
        # only as trustworthy as its least confident contributing capability.
        confidence = min((r.confidence for r in succeeded), default=0.0)
        if degraded:
            confidence *= 0.85

        merged_output = {r.capability: r.output for r in succeeded}
        all_citations = {c.chunk_id: c for c in citations}
        for r in succeeded:
            for c in r.citations:
                all_citations[c.chunk_id] = c

        duration_ms = int((time.perf_counter() - started) * 1000)
        tokens_in = sum(r.tokens_in for r in results.values())
        tokens_out = sum(r.tokens_out for r in results.values())

        explanation = Explanation(
            summary=self._summarize(plan, succeeded, failed, degraded),
            confidence=round(min(max(confidence, 0.0), 1.0), 4),
            capabilities_used=[r.capability for r in succeeded],
            knowledge_used=list(all_citations.values()),
            degraded_inputs=degraded,
            alternatives=[a for r in succeeded for a in r.alternatives],
            reasoning="\n\n".join(
                f"[{r.capability}] {r.reasoning}" for r in succeeded if r.reasoning
            ),
            reasoning_trace_id=execution.id,
        )

        execution.status = status.value
        execution.output = merged_output
        execution.summary = explanation.summary
        execution.reasoning = explanation.reasoning
        execution.confidence = explanation.confidence
        execution.capabilities_used = explanation.capabilities_used
        execution.knowledge_used = [c.model_dump(mode="json") for c in explanation.knowledge_used]
        execution.alternatives = [a.model_dump(mode="json") for a in explanation.alternatives]
        execution.degraded_inputs = degraded
        execution.tokens_in = tokens_in
        execution.tokens_out = tokens_out
        execution.duration_ms = duration_ms
        execution.llm_calls = len(succeeded)
        execution.credits = max(1, (tokens_in + tokens_out) // 1000)
        execution.completed_at = datetime.now(timezone.utc)
        if failed:
            execution.error_detail = "; ".join(
                f"{r.capability}: {r.error}" for r in failed
            )[:2000]

        # Gate every proposed side effect (§12.3). A capability proposes; only
        # an approved request may ever reach a customer.
        approvals = await self._gate_actions(execution, succeeded)
        if approvals:
            status = ExecutionStatus.PENDING_APPROVAL
            execution.status = status.value

        await self.db.flush()

        return AgentResponse(
            session_id=session.id,
            execution_id=execution.id,
            status=status,
            output=merged_output,
            explanation=explanation,
            approvals=approvals,
            usage=UsageStats(
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                credits=execution.credits,
                duration_ms=duration_ms,
                llm_calls=len(succeeded),
            ),
            created_at=execution.created_at,
        )

    async def _gate_actions(
        self, execution: AgentExecution, results: list[CapabilityResult]
    ) -> list[ApprovalRef]:
        """Turn each `proposed_action` into a pending ApprovalRequest.

        This is the seam that makes the whole "agents don't act autonomously"
        guarantee real. Before this existed, capabilities emitted proposals into
        the void — the buttons in the UI had nothing to call.
        """
        from ..governance.approvals import ApprovalService

        service = ApprovalService(self.db)
        refs: list[ApprovalRef] = []

        for result in results:
            if not result.proposed_action:
                continue
            try:
                request = await service.create_from_proposal(
                    proposal=result.proposed_action,
                    workspace=execution.workspace,
                    execution_id=execution.id,
                    confidence=result.confidence,
                    origin_service=f"orbq-{execution.workspace}",
                )
            except Exception as exc:  # noqa: BLE001
                # Fail CLOSED: if the gate cannot be created, the action must
                # not proceed. Log loudly rather than silently letting an
                # ungated side effect through (§10.7).
                log.error(
                    "approval_creation_failed",
                    capability=result.capability,
                    error=str(exc),
                )
                continue

            refs.append(
                ApprovalRef(
                    id=request.id,
                    action_type=request.action_type,
                    status=request.status,
                    expires_at=request.expires_at,
                )
            )

        return refs

    @staticmethod
    def _summarize(
        plan: ExecutionPlan,
        succeeded: list[CapabilityResult],
        failed: list[CapabilityResult],
        degraded: list[str],
    ) -> str:
        parts = [f"Ran {len(succeeded)} of {len(plan.capabilities)} planned capabilities."]
        if failed:
            parts.append(f"{len(failed)} failed: {', '.join(r.capability for r in failed)}.")
        if "knowledge:low_confidence" in degraded:
            parts.append(
                "The knowledge base had no strongly matching content, so this "
                "answer is not grounded in your documents."
            )
        if any(d.endswith(":unavailable") for d in degraded):
            missing = [d.split(":")[0] for d in degraded if d.endswith(":unavailable")]
            parts.append(f"Ran without: {', '.join(missing)}.")
        return " ".join(parts)
