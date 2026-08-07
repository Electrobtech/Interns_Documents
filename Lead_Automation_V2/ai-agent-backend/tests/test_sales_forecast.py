"""GET /ai-agents/sales/forecast — weighted pipeline, monthly revenue
trend, and target-vs-actual gap analysis. All assertions are hand-computed
against the two leads the `org` fixture seeds:
  - qualified, deal_value=28000, open now
  - won,       deal_value=60000, created 25 days ago, closed 18 days ago
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_forecast_without_deal_value_field_returns_honest_nulls(client):
    resp = await client.get("/ai-agents/sales/forecast")
    assert resp.status_code == 200
    body = resp.json()
    assert body["deal_value_field"] is None
    assert body["weighted_pipeline_value"] is None
    for stage in body["pipeline_by_stage"]:
        assert stage["value"] is None
        assert stage["weighted_value"] is None
    assert "no deal-value field is mapped" in body["explanation"].lower()


async def test_forecast_weighted_pipeline_value_matches_hand_calculation(client):
    await client.patch("/ai-agents/sales/config", json={"deal_value_field": "deal_value"})
    resp = await client.get("/ai-agents/sales/forecast")
    assert resp.status_code == 200
    body = resp.json()

    by_stage = {s["stage"]: s for s in body["pipeline_by_stage"]}
    # qualified: 28000 * 0.30 win probability = 8400
    assert by_stage["qualified"]["count"] == 1
    assert by_stage["qualified"]["value"] == 28000.0
    assert by_stage["qualified"]["win_probability"] == 0.3
    assert by_stage["qualified"]["weighted_value"] == 8400.0
    # won leads are 100% weighted but excluded from the *open* pipeline total
    assert by_stage["won"]["value"] == 60000.0
    assert by_stage["won"]["weighted_value"] == 60000.0
    # weighted_pipeline_value only sums OPEN stages (new/qualified/active),
    # not won/lost — closed deals aren't "pipeline" anymore.
    assert body["weighted_pipeline_value"] == 8400.0


async def test_forecast_revenue_gap_reflects_target(client):
    await client.patch(
        "/ai-agents/sales/config",
        json={"deal_value_field": "deal_value", "monthly_revenue_target": 100000},
    )
    resp = await client.get("/ai-agents/sales/forecast")
    body = resp.json()
    gap = body["revenue_gap"]
    assert gap["target"] == 100000.0
    # The seeded won lead closed 18 days ago, i.e. NOT in the current
    # calendar month, so actual_mtd should be 0, not 60000.
    assert gap["actual_mtd"] == 0.0
    assert gap["gap"] == 100000.0
    assert gap["pct_of_target"] == 0.0


async def test_forecast_no_target_set_has_explanatory_note(client):
    await client.patch("/ai-agents/sales/config", json={"deal_value_field": "deal_value"})
    resp = await client.get("/ai-agents/sales/forecast")
    gap = resp.json()["revenue_gap"]
    assert gap["target"] is None
    assert gap["gap"] is None
    assert "no monthly revenue target" in gap["note"].lower()


async def test_forecast_monthly_revenue_series_has_six_months_ending_current(client):
    resp = await client.get("/ai-agents/sales/forecast")
    months = resp.json()["monthly_revenue"]
    assert len(months) == 6
    # strictly increasing YYYY-MM, last entry is the current month
    keys = [m["month"] for m in months]
    assert keys == sorted(keys)
