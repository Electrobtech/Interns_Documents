"""Parses a natural-language finance command ("Record ₹45,000 developer
salary payment", "Log ₹12,400 BESCOM electricity bill") into a structured,
*proposed* finance_transactions row.

Deliberately rule-based rather than an LLM JSON-response call (the pattern
every other agent in this codebase uses, e.g. sales_agent.py) — a wrong LLM
guess on an amount here writes a wrong number into a real financial ledger,
which is a materially different risk than a wrong guess in a drafted
follow-up email a human reads before sending. Keeping this a small, legible
regex/keyword parser means the "why did it pick this category/amount" is
always inspectable, which matters more here than parser sophistication —
and every result still goes through POST /finance/propose ->
POST /finance/confirm (a human reviews the parse before anything is
written), never a direct write. See api/v1/finance_agent.py for that flow
and app/agents/sales_agent.py's SYSTEM_PROMPT for the "never take direct
action, only propose" rule this mirrors.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

EXPENSE_CATEGORIES = ["SALARY", "UTILITIES", "TAXES", "VENDOR", "SOFTWARE", "RENT", "OTHER"]

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "SALARY": ["salary", "payroll", "wages", "stipend"],
    "UTILITIES": ["bescom", "electricity", "water bill", "internet bill", "utility", "utilities", "broadband"],
    "TAXES": ["tax", "gst paid", "tds paid", "advance tax", "income tax"],
    "SOFTWARE": ["subscription", "saas", "software", "license", "licence", "hosting", "domain"],
    "RENT": ["rent", "lease"],
    "VENDOR": ["vendor", "supplier", "invoice from", "contractor"],
}

# ₹45,000 | Rs. 45000 | 45000 rupees | 45k
_AMOUNT_RE = re.compile(
    r"(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k)?|"
    r"([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:rupees|rs\.?|inr)",
    re.IGNORECASE,
)


@dataclass
class FinanceProposal:
    action: str  # "record_expense" | "generate_course_invoice" | "unrecognized"
    confidence: str  # "high" | "low" — low means the amount or category is a guess; UI should nudge the human to double-check
    category: str | None = None
    amount: float | None = None
    description: str | None = None
    warnings: list[str] = field(default_factory=list)


def _extract_amount(text: str) -> float | None:
    m = _AMOUNT_RE.search(text)
    if not m:
        return None
    raw, k1, raw2, k2 = m.groups()
    value_str = (raw or raw2 or "").replace(",", "")
    if not value_str:
        return None
    try:
        value = float(value_str)
    except ValueError:
        return None
    if k1 or k2:
        value *= 1000
    return value


def _extract_category(text: str) -> str | None:
    lower = text.lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return category
    return None


def parse_finance_command(text: str) -> FinanceProposal:
    """Best-guess parse of an expense-logging command. Course-invoice
    commands ("enroll <student> in <course> for ₹X") are intentionally NOT
    handled by this free-text parser — that action needs a validated
    student name + state (for place-of-supply), which is a form, not a
    one-line chat command; the Invoices & Revenue tab's "Generate GST
    Invoice" modal is the intended path for that one."""
    amount = _extract_amount(text)
    category = _extract_category(text)
    warnings = []

    if amount is None:
        return FinanceProposal(action="unrecognized", confidence="low", warnings=["Could not find a rupee amount in this message."])

    if category is None:
        category = "OTHER"
        warnings.append("Could not confidently match a category — defaulted to OTHER, please pick the right one.")

    return FinanceProposal(
        action="record_expense",
        confidence="low" if warnings else "high",
        category=category,
        amount=amount,
        description=text.strip()[:300],
        warnings=warnings,
    )
