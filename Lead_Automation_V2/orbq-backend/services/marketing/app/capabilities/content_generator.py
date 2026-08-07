"""Content generation — the marketing agent's default capability."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext

from orbq_ai.capability import BaseCapability

ContentFormat = Literal[
    "blog_post", "landing_page", "email", "whatsapp", "sms",
    "social_post", "ad_copy", "product_description",
]


class ContentVariant(BaseModel):
    label: str = Field(description="e.g. 'A — benefit-led', 'B — problem-led'")
    headline: str | None = None
    body: str
    call_to_action: str
    rationale: str = Field(description="Why this angle, and who it targets")


class ContentOutput(BaseModel):
    format: ContentFormat
    variants: list[ContentVariant] = Field(min_length=1, max_length=3)
    tone_notes: str
    claims_requiring_verification: list[str] = Field(
        default_factory=list,
        description="Any factual claim in the copy not backed by the knowledge base",
    )
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class ContentGeneratorCapability(BaseCapability):
    name = "content_generator"
    workspace = Workspace.MARKETING
    description = (
        "Marketing copy in the organization's voice — blog posts, landing pages, "
        "emails, WhatsApp/SMS, ads, social. The default marketing capability."
    )
    output_schema = ContentOutput
    # Copy is drafted, not published. Publication is a separate gated action.
    action_type = "content.publish"
    cost_hint = 2500
    temperature = 0.6
    max_tokens = 3500

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You write marketing copy in the customer's own voice, using their "
            "own facts.\n\n"
            "Hard rules:\n"
            "1. Never invent a statistic, customer name, case-study result, "
            "award, or integration. If the copy would benefit from one and the "
            "knowledge base lacks it, write a clearly-marked placeholder like "
            "[INSERT METRIC] and list it in `claims_requiring_verification`.\n"
            "2. Match the format's constraints: SMS under 160 characters; "
            "WhatsApp conversational and short; ad copy within platform limits; "
            "landing pages structured with scannable sections.\n"
            "3. Mirror the tone of the customer's existing materials. If none "
            "were retrieved, default to clear and direct — never to hype.\n"
            "4. Produce 2-3 genuinely different angles, not three rewordings of "
            "the same sentence. A/B testing near-identical copy teaches nothing.\n"
            "5. No fake urgency, no manufactured scarcity, no claims a "
            "regulator would object to.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        blocks = [
            f"<request>\n{ctx.message}\n</request>",
            self.upstream_block(ctx),
            self.knowledge_block(ctx),
            self.memory_block(ctx),
        ]
        return "\n\n".join(b for b in blocks if b)

    def proposed_action(self, parsed: ContentOutput, ctx: CapabilityContext) -> dict | None:
        # Only gate formats that go somewhere public. Drafting an email body for
        # review is not a side effect; publishing a landing page is.
        if parsed.format not in {"blog_post", "landing_page", "social_post", "ad_copy"}:
            return None
        return {
            "action_type": self.action_type,
            "summary": f"Publish {parsed.format.replace('_', ' ')}: {parsed.variants[0].headline or parsed.variants[0].body[:60]}",
            "executor": "manual",
            "payload": parsed.model_dump(mode="json"),
            "reversible": True,
            "requires_role": "manager",
        }
