"""Finance Agent tools — request/response schemas for the propose/confirm
flow (see api/v1/finance_agent.py)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class FinanceProposeIn(BaseModel):
    text: str = Field(..., min_length=1, description="Natural-language command, e.g. 'Log ₹12,400 BESCOM electricity bill'")


class FinanceProposeOut(BaseModel):
    action: str
    confidence: str
    category: str | None = None
    amount: float | None = None
    description: str | None = None
    warnings: list[str] = []


class FinanceConfirmIn(BaseModel):
    action: str = Field(..., description="'record_expense' — the only action this endpoint commits")
    category: str
    amount: float = Field(..., gt=0)
    description: str | None = None
    payment_method: str | None = None
    reference_id: str | None = None


class FinanceSummaryOut(BaseModel):
    period: dict
    totalRevenue: float
    totalExpenses: float
    netProfit: float
    byCategory: dict
    currency: str = "INR"
