"""The capability contract — the single protocol every AI capability implements.

Uniformity here is what lets the orchestrator compose ~30 capabilities across
three services without special-casing any of them (§10.2). Adding a capability
is one file plus a registry line: no API change, no schema change, no gateway
change, no frontend change.
"""
from __future__ import annotations

import uuid
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from .agent import AgentContext, Alternative, KnowledgeCitation, Workspace


class CapabilityContext(BaseModel):
    """Everything a capability needs to run. Assembled by the orchestrator."""

    org_id: uuid.UUID
    user_id: uuid.UUID
    workspace: Workspace
    session_id: uuid.UUID
    execution_id: uuid.UUID

    message: str
    context: AgentContext = Field(default_factory=AgentContext)

    # Retrieved knowledge, pre-fetched by the orchestrator so N capabilities in
    # one plan share a single retrieval rather than each issuing their own.
    knowledge: list[KnowledgeCitation] = Field(default_factory=list)
    knowledge_text: str = ""

    # Memory context (short-term turns + long-term facts + entity memory).
    memory: dict[str, Any] = Field(default_factory=dict)

    # Outputs of capabilities this one declared in `requires`.
    upstream: dict[str, dict[str, Any]] = Field(default_factory=dict)

    # Dependencies that could not be reached; a capability should factor these
    # into its confidence rather than pretending it had full context.
    degraded_inputs: list[str] = Field(default_factory=list)

    token_budget: int = 8000


class CapabilityResult(BaseModel):
    """What every capability returns. The orchestrator merges these into the
    response envelope and the decision trace."""

    capability: str
    output: dict[str, Any]
    reasoning: str = ""
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    citations: list[KnowledgeCitation] = Field(default_factory=list)
    alternatives: list[Alternative] = Field(default_factory=list)
    business_impact: str | None = None

    # Set when the capability proposes a side effect. The orchestrator opens an
    # ApprovalRequest instead of letting the action execute (§12.3).
    proposed_action: dict[str, Any] | None = None

    tokens_in: int = 0
    tokens_out: int = 0
    duration_ms: int = 0
    prompt_version: str | None = None
    model: str | None = None
    degraded: bool = False
    error: str | None = None


class CapabilityManifest(BaseModel):
    """Self-description, served at GET /internal/capabilities.

    The orchestrator discovers capabilities at startup rather than hardcoding a
    list, so deploying a new capability requires no orchestrator change.
    """

    name: str
    workspace: Workspace
    description: str
    requires: list[str] = Field(default_factory=list)
    action_type: str | None = None  # set → approval-gated
    cost_hint: int = 1000           # rough token estimate, for budget pruning
    deterministic: bool = False     # eligible for response caching (§20.4)
    needs_knowledge: bool = True


@runtime_checkable
class Capability(Protocol):
    """Structural protocol — capabilities need only match the shape."""

    manifest: CapabilityManifest

    async def run(self, ctx: CapabilityContext) -> CapabilityResult: ...
