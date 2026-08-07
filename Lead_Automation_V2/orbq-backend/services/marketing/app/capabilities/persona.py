"""Buyer persona / ICP generation."""
from __future__ import annotations

from pydantic import BaseModel, Field

from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext

from orbq_ai.capability import BaseCapability


class Persona(BaseModel):
    name: str = Field(description="Memorable label, e.g. 'Ops-Led Olivia'")
    role: str
    company_profile: str = Field(description="Segment, size, industry")
    goals: list[str]
    pain_points: list[str]
    objections: list[str] = Field(description="Why they would say no")
    buying_triggers: list[str]
    preferred_channels: list[str]
    messaging_angles: list[str]
    disqualifiers: list[str] = Field(
        default_factory=list, description="Signals this is NOT a fit"
    )


class PersonaOutput(BaseModel):
    personas: list[Persona]
    icp_summary: str = Field(description="One-paragraph ideal customer profile")
    evidence_basis: str = Field(
        description="What in the knowledge base supports this, or 'inferred' if nothing did"
    )
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class PersonaCapability(BaseCapability):
    name = "persona"
    workspace = Workspace.MARKETING
    description = (
        "Buyer personas and ideal customer profile from the organization's own "
        "materials. Use for audience definition, targeting, ICP work."
    )
    output_schema = PersonaOutput
    cost_hint = 2200
    temperature = 0.4

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You build buyer personas from evidence, not from generic B2B "
            "templates.\n\n"
            "Hard rules:\n"
            "1. Every persona attribute must trace to something in the knowledge "
            "base. In `evidence_basis`, state plainly what supported it — and if "
            "nothing did, write 'inferred from general market patterns' and set "
            "confidence below 0.4.\n"
            "2. A persona that could describe any SaaS buyer is useless. Be "
            "specific to THIS business or admit you lack the material to be.\n"
            "3. `disqualifiers` matter as much as fit signals — knowing who to "
            "ignore protects the pipeline.\n"
            "4. Produce at most 3 personas. More than that is a taxonomy nobody "
            "will use.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        blocks = [
            f"<request>\n{ctx.message}\n</request>",
            self.knowledge_block(ctx),
            self.memory_block(ctx),
            self.upstream_block(ctx),
        ]
        return "\n\n".join(b for b in blocks if b)
