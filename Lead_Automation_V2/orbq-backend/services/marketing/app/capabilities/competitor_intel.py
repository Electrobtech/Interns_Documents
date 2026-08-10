"""Competitor intelligence.

The honesty constraint here is unusually important. Orbq has no competitor
crawler, no pricing scraper, and no market-data feed. Anything the model
"knows" about a named competitor is training-data recall, which may be stale or
wrong. A confident competitive claim that turns out to be false costs a deal.

So: every claim carries a source and a basis, and unsupported claims are
labelled `unverified` rather than dropped or dressed up.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext

from orbq_ai.capability import BaseCapability


class Claim(BaseModel):
    statement: str
    basis: Literal["knowledge_base", "model_prior", "inference"] = Field(
        description=(
            "knowledge_base = supported by a retrieved passage; "
            "model_prior = recalled from training data and NOT verified; "
            "inference = reasoned from other facts"
        )
    )
    source_hint: str | None = Field(
        default=None, description="Which document supports it, when basis is knowledge_base"
    )


class CompetitorProfile(BaseModel):
    name: str
    positioning: str
    strengths: list[Claim]
    weaknesses: list[Claim]
    pricing_notes: list[Claim] = Field(default_factory=list)
    target_segments: list[str] = Field(default_factory=list)


class SWOT(BaseModel):
    strengths: list[str]
    weaknesses: list[str]
    opportunities: list[str]
    threats: list[str]


class CompetitorIntelOutput(BaseModel):
    competitors: list[CompetitorProfile]
    own_swot: SWOT
    differentiation_angles: list[str] = Field(
        description="How to position against these competitors"
    )
    unverified_claim_count: int = Field(
        description="How many claims are basis=model_prior — the caller must see this"
    )
    data_gaps: list[str] = Field(
        description="What you would need to make this analysis reliable"
    )
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class CompetitorIntelCapability(BaseCapability):
    name = "competitor_intel"
    workspace = Workspace.MARKETING
    description = (
        "Competitor positioning, SWOT, and differentiation angles. Grounded in "
        "the knowledge base; unverified claims are labelled as such."
    )
    output_schema = CompetitorIntelOutput
    cost_hint = 2800
    temperature = 0.35
    max_tokens = 3500

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You are a competitive analyst with NO live data sources. No web "
            "crawler, no pricing scraper, no market-research feed.\n\n"
            "Hard rules:\n"
            "1. Label every claim's `basis` honestly. If you are recalling "
            "something about a competitor from training data, it is "
            "`model_prior` — which means it may be outdated or wrong. Never "
            "dress a recollection up as research.\n"
            "2. Pricing changes constantly. Any pricing claim not present in the "
            "knowledge base MUST be basis=model_prior, and you should say it "
            "needs verification.\n"
            "3. Count your model_prior claims accurately in "
            "`unverified_claim_count`. The user needs to know how much of this "
            "to trust.\n"
            "4. `data_gaps` should name what would actually make this reliable — "
            "a pricing page, a G2 export, a win/loss log.\n"
            "5. If the knowledge base contains nothing about competitors, say so "
            "directly and set confidence below 0.35. A confident-sounding "
            "analysis built on nothing is worse than an admission.\n\n"
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

    def assess_confidence(self, parsed: CompetitorIntelOutput, ctx: CapabilityContext) -> float:
        """Penalize unverified claims on top of the standard grounding check.

        An analysis that is mostly model_prior recall should not read as
        confident, however fluent it sounds.
        """
        base = super().assess_confidence(parsed, ctx)

        total = sum(
            len(c.strengths) + len(c.weaknesses) + len(c.pricing_notes)
            for c in parsed.competitors
        )
        if total:
            unverified_ratio = parsed.unverified_claim_count / total
            base *= 1.0 - (0.5 * min(unverified_ratio, 1.0))

        return round(min(max(base, 0.0), 1.0), 4)
