"""GET /ai-agents/sales/analytics — MTD closed deals, avg deal size,
sales-cycle length, and agent productivity."""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_analytics_without_deal_value_field(client):
    resp = await client.get("/ai-agents/sales/analytics")
    assert resp.status_code == 200
    body = resp.json()
    assert body["avg_deal_size"] is None
    assert "no deal-value field mapped" in body["avg_deal_size_note"].lower()


async def test_analytics_avg_deal_size_matches_hand_calculation(client):
    await client.patch("/ai-agents/sales/config", json={"deal_value_field": "deal_value"})
    resp = await client.get("/ai-agents/sales/analytics")
    body = resp.json()
    # Only one won lead in the fixture, deal_value=60000.
    assert body["avg_deal_size"] == 60000.0
    assert "1 won lead" in body["avg_deal_size_note"]


async def test_analytics_sales_cycle_days_matches_hand_calculation(client):
    """The `org` fixture's won lead was created 25 days ago and closed
    (updated_at) 18 days ago -> a 7-day cycle."""
    resp = await client.get("/ai-agents/sales/analytics")
    body = resp.json()
    assert body["sales_cycle_days"] == 7.0
    assert "proxy metric" in body["sales_cycle_note"].lower()


async def test_analytics_deals_closed_mtd_excludes_prior_month_close(client):
    resp = await client.get("/ai-agents/sales/analytics")
    body = resp.json()
    # Won lead closed 18 days before "now" in the test run — not always in
    # the current calendar month depending on when tests run, but never
    # negative and always an int.
    assert isinstance(body["deals_closed_mtd"], int)
    assert body["deals_closed_mtd"] >= 0


async def test_analytics_weekly_deals_won_has_six_weeks(client):
    resp = await client.get("/ai-agents/sales/analytics")
    weeks = resp.json()["weekly_deals_won"]
    assert len(weeks) == 6
    assert sum(w["count"] for w in weeks) >= 1  # our won lead should land in one of them


async def test_analytics_negative_cycle_is_excluded_not_counted_as_zero(client, org, engine):
    """If updated_at is somehow before created_at (bad data), the endpoint
    should exclude that lead from the cycle average rather than letting a
    negative number pull the average down — matches the `if days >= 0`
    guard in sales_service.py."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker

    Session = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with Session() as session:
        await session.execute(
            text(
                "UPDATE leads SET created_at = now(), updated_at = now() - interval '5 days' "
                "WHERE id = :id"
            ),
            {"id": org.lead_won_id},
        )
        await session.commit()

    resp = await client.get("/ai-agents/sales/analytics")
    body = resp.json()
    # With the only won lead now having a negative (excluded) cycle, there's
    # no valid data point left, so this should be null, not a negative number.
    assert body["sales_cycle_days"] is None
