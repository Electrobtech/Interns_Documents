"""SEO keyword research and content briefs.

Grounded in the customer's own knowledge base — Orbq has no external SEO tool
connected, and the prompt says so explicitly rather than letting the model
hallucinate search volumes it cannot know.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext

from orbq_ai.capability import BaseCapability


class Keyword(BaseModel):
    term: str
    intent: Literal["informational", "commercial", "transactional", "navigational"]
    priority: Literal["high", "medium", "low"]
    rationale: str = Field(description="Why this term matters for this business")


class ContentBrief(BaseModel):
    title: str
    meta_description: str = Field(max_length=320)
    target_keyword: str
    outline: list[str] = Field(description="H2/H3 section headings in order")
    internal_link_ideas: list[str] = Field(default_factory=list)
    word_count_target: int


class SEOOutput(BaseModel):
    primary_keywords: list[Keyword]
    secondary_keywords: list[Keyword] = Field(default_factory=list)
    content_brief: ContentBrief
    gaps: list[str] = Field(
        default_factory=list,
        description="Topics the knowledge base does not cover but should",
    )
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class SEOCapability(BaseCapability):
    name = "seo"
    workspace = Workspace.MARKETING
    description = (
        "Keyword research and content briefs grounded in the organization's "
        "knowledge base. Use for search visibility, keyword strategy, blog planning."
    )
    output_schema = SEOOutput
    cost_hint = 2000
    temperature = 0.3

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You are an SEO strategist working strictly from the customer's own "
            "documents.\n\n"
            "Hard rules:\n"
            "1. You have NO access to search-volume tools, rank trackers, or "
            "competitor crawls. Never state a search volume, difficulty score, "
            "or ranking position — you cannot know them.\n"
            "2. Ground every keyword in evidence from the knowledge base. If the "
            "base is empty, say so in `reasoning`, set confidence below 0.4, and "
            "propose keywords as hypotheses rather than findings.\n"
            "3. Prefer terms the customer's own materials already use — those "
            "reflect how their buyers actually talk.\n"
            "4. `gaps` is where you flag topics their content should cover but "
            "does not. This is often the most valuable part of the output.\n\n"
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
