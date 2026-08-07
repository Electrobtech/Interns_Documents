"""Remaining marketing capabilities: AEO, anti-ban, CTWA, cold revival,
brand tone, sentiment, content calendar.

Grouped in one module because each is a prompt plus a schema — splitting seven
small capabilities into seven files would be noise. Each still registers
independently and is individually selectable by the planner.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from orbq_contracts.agent import Workspace
from orbq_contracts.capability import CapabilityContext

from orbq_ai.capability import BaseCapability


# ---------------------------------------------------------------------------
# AEO — Answer Engine Optimization
# ---------------------------------------------------------------------------


class AEOOutput(BaseModel):
    answer_ready_summary: str = Field(
        description="A 40-60 word extractable answer an AI engine could quote"
    )
    question_variants: list[str] = Field(description="How users actually phrase this")
    structured_facts: list[str] = Field(description="Atomic, quotable, verifiable facts")
    schema_markup_suggestions: list[str]
    citation_hooks: list[str] = Field(
        description="Statements distinctive enough that an AI engine would attribute them"
    )
    weaknesses: list[str] = Field(description="Why an answer engine might skip this content")
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class AEOCapability(BaseCapability):
    name = "aeo"
    workspace = Workspace.MARKETING
    description = (
        "Answer Engine Optimization — restructure content so AI search engines "
        "(ChatGPT, Perplexity, AI Overviews) can extract and cite it."
    )
    output_schema = AEOOutput
    cost_hint = 2000
    temperature = 0.3

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You optimize content for AI answer engines, not classic search "
            "rankings.\n\n"
            "What actually gets cited by an answer engine: a direct answer in "
            "the first sentence, atomic verifiable facts, clear question-shaped "
            "headings, and specific claims rather than vague marketing language. "
            "What gets skipped: hedging, superlatives without evidence, and "
            "answers buried under three paragraphs of preamble.\n\n"
            "Hard rules:\n"
            "1. `answer_ready_summary` must stand alone. If quoted with no other "
            "context, it should still be correct and useful.\n"
            "2. Every structured fact must be traceable to the knowledge base. "
            "Never invent one to make the content more quotable.\n"
            "3. `weaknesses` should be blunt about why this content might be "
            "ignored.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        return "\n\n".join(
            b for b in [
                f"<request>\n{ctx.message}\n</request>",
                self.knowledge_block(ctx),
                self.upstream_block(ctx),
            ] if b
        )


# ---------------------------------------------------------------------------
# Anti-ban / deliverability pre-flight
# ---------------------------------------------------------------------------


class PolicyFlag(BaseModel):
    severity: Literal["block", "warn", "info"]
    issue: str
    offending_text: str | None = None
    fix: str


class AntiBanOutput(BaseModel):
    risk_level: Literal["low", "medium", "high", "critical"]
    risk_score: int = Field(ge=0, le=100)
    flags: list[PolicyFlag]
    revised_message: str | None = Field(
        default=None, description="A compliant rewrite, when the original is fixable"
    )
    safe_to_send: bool
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class AntiBanCapability(BaseCapability):
    name = "anti_ban"
    workspace = Workspace.MARKETING
    description = (
        "Pre-flight check for WhatsApp/Meta policy and spam risk before a "
        "broadcast. Flags content likely to trigger a ban or filter."
    )
    output_schema = AntiBanOutput
    cost_hint = 1200
    temperature = 0.1
    needs_knowledge = False  # policy judgement, not corpus-dependent

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You review outbound message copy for policy and deliverability "
            "risk before it is broadcast.\n\n"
            "Flag as `block`: unsolicited promotional content outside a 24h "
            "session window, misleading claims, impersonation of a brand or "
            "person, adult/gambling/pharma content, unverified financial or "
            "medical promises, and missing opt-out on bulk marketing.\n\n"
            "Flag as `warn`: excessive capitals or emoji, urgency manipulation "
            "('ACT NOW'), link shorteners (they correlate with spam scoring), "
            "high link density, and generic templated copy at volume.\n\n"
            "Be conservative. A false positive costs one rewrite; a false "
            "negative can cost the customer their WhatsApp Business number "
            "permanently. `safe_to_send` must be false if ANY block-level flag "
            "is present.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        return f"<message_to_review>\n{ctx.message}\n</message_to_review>\n\n" + (
            self.upstream_block(ctx) or ""
        )


# ---------------------------------------------------------------------------
# Click-to-WhatsApp ads
# ---------------------------------------------------------------------------


class CTWAOutput(BaseModel):
    ad_headlines: list[str] = Field(max_length=5)
    primary_texts: list[str] = Field(max_length=3)
    greeting_message: str = Field(description="Auto-reply when the user opens the chat")
    qualifying_questions: list[str] = Field(description="Questions the bot asks to qualify")
    targeting_notes: str
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class CTWACapability(BaseCapability):
    name = "ctwa"
    workspace = Workspace.MARKETING
    description = (
        "Click-to-WhatsApp ad packages: ad copy plus the auto-greeting and "
        "qualifying flow that runs when someone taps through."
    )
    output_schema = CTWAOutput
    cost_hint = 2000
    temperature = 0.5

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You design Click-to-WhatsApp ad packages.\n\n"
            "The ad and the greeting are one experience: the greeting must "
            "continue the promise the ad made, or the user drops immediately.\n\n"
            "Constraints: headlines within 40 characters, primary text within "
            "125 characters before truncation, greeting warm and human (not a "
            "form), and at most 3 qualifying questions — more feels like an "
            "interrogation and kills conversion.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        return "\n\n".join(
            b for b in [
                f"<request>\n{ctx.message}\n</request>",
                self.upstream_block(ctx),
                self.knowledge_block(ctx),
            ] if b
        )


# ---------------------------------------------------------------------------
# Cold lead revival
# ---------------------------------------------------------------------------


class RevivalStep(BaseModel):
    day_offset: int
    channel: Literal["whatsapp", "email", "sms"]
    message: str
    intent: str = Field(description="What this step is trying to achieve")


class ColdRevivalOutput(BaseModel):
    sequence: list[RevivalStep]
    segment_criteria: str
    exit_conditions: list[str] = Field(description="When to stop contacting someone")
    expected_friction: list[str]
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class ColdRevivalCapability(BaseCapability):
    name = "cold_lead_revival"
    workspace = Workspace.MARKETING
    description = "Re-engagement drip sequences for dormant leads."
    output_schema = ColdRevivalOutput
    action_type = "campaign.publish"
    cost_hint = 2200
    temperature = 0.5

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You design re-engagement sequences for leads who went quiet.\n\n"
            "Principles that actually work: lead with something useful rather "
            "than 'just checking in'; acknowledge the silence without guilt-"
            "tripping; give an easy exit in every message; and stop after 3-4 "
            "touches — persistence past that damages the brand and the sender "
            "reputation.\n\n"
            "`exit_conditions` is mandatory and must include an explicit opt-out "
            "path. A revival sequence with no stop condition is a spam engine.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        return "\n\n".join(
            b for b in [
                f"<request>\n{ctx.message}\n</request>",
                self.upstream_block(ctx),
                self.knowledge_block(ctx),
                self.memory_block(ctx),
            ] if b
        )

    def proposed_action(self, parsed: ColdRevivalOutput, ctx: CapabilityContext) -> dict:
        return {
            "action_type": self.action_type,
            "summary": f"Launch cold-lead revival sequence ({len(parsed.sequence)} touches)",
            "executor": "campaign-service",
            "payload": parsed.model_dump(mode="json"),
            "reversible": False,
            "requires_role": "manager",
        }


# ---------------------------------------------------------------------------
# Brand tone
# ---------------------------------------------------------------------------


class BrandToneOutput(BaseModel):
    voice_attributes: list[str]
    do_use: list[str]
    avoid: list[str]
    example_rewrites: list[dict[str, str]] = Field(
        description="[{'before': ..., 'after': ...}]"
    )
    evidence_basis: str
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class BrandToneCapability(BaseCapability):
    name = "brand_tone"
    workspace = Workspace.MARKETING
    description = "Extract and codify the organization's brand voice from its own materials."
    output_schema = BrandToneOutput
    cost_hint = 1600
    temperature = 0.3

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You derive a brand voice guide from the customer's actual writing, "
            "not from brand-strategy clichés.\n\n"
            "Every attribute must be observable in the retrieved material — "
            "quote or paraphrase what led you there in `evidence_basis`. If the "
            "knowledge base has no representative copy, say so and set "
            "confidence below 0.4 rather than producing a generic guide that "
            "would fit any company.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        return "\n\n".join(
            b for b in [f"<request>\n{ctx.message}\n</request>", self.knowledge_block(ctx)] if b
        )


# ---------------------------------------------------------------------------
# Sentiment
# ---------------------------------------------------------------------------


class SentimentOutput(BaseModel):
    overall: Literal["positive", "neutral", "negative", "mixed"]
    score: float = Field(ge=-1.0, le=1.0)
    themes: list[dict[str, str]] = Field(description="[{'theme':..., 'sentiment':..., 'evidence':...}]")
    urgent_issues: list[str] = Field(default_factory=list)
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class SentimentCapability(BaseCapability):
    name = "sentiment"
    workspace = Workspace.MARKETING
    description = "Sentiment and theme analysis across customer feedback, reviews, or comments."
    output_schema = SentimentOutput
    cost_hint = 1200
    temperature = 0.2
    needs_knowledge = False

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You analyze sentiment in customer feedback.\n\n"
            "Ground every theme in an actual quote or paraphrase from the input "
            "— a theme with no evidence is a guess. Flag anything in "
            "`urgent_issues` that suggests churn risk, a legal or safety "
            "concern, or public escalation; those need a human today, not a "
            "dashboard next week.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        return f"<feedback_to_analyze>\n{ctx.message}\n</feedback_to_analyze>"


# ---------------------------------------------------------------------------
# Content calendar
# ---------------------------------------------------------------------------


class CalendarEntry(BaseModel):
    date_offset_days: int
    channel: str
    format: str
    topic: str
    hook: str
    linked_keyword: str | None = None


class ContentCalendarOutput(BaseModel):
    entries: list[CalendarEntry]
    cadence_rationale: str
    themes: list[str]
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)


class ContentCalendarCapability(BaseCapability):
    name = "content_calendar"
    workspace = Workspace.MARKETING
    description = "A scheduled content plan across channels and formats."
    output_schema = ContentCalendarOutput
    requires = ["seo"]
    cost_hint = 2400
    temperature = 0.45

    def system_prompt(self, ctx: CapabilityContext) -> str:
        return (
            "You build content calendars that a small team can actually "
            "sustain.\n\n"
            "A calendar nobody can keep up with is worse than none — it just "
            "generates guilt. Default to a realistic cadence and justify it in "
            "`cadence_rationale`. Where upstream SEO keywords exist, tie entries "
            "to them via `linked_keyword` so the calendar serves a strategy "
            "rather than filling slots.\n\n"
            + self.schema_block()
        )

    def user_prompt(self, ctx: CapabilityContext) -> str:
        return "\n\n".join(
            b for b in [
                f"<request>\n{ctx.message}\n</request>",
                self.upstream_block(ctx),
                self.knowledge_block(ctx),
            ] if b
        )
