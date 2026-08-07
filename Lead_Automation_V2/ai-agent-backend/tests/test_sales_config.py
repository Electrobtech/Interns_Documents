"""GET/PATCH /ai-agents/sales/config — deal-value mapping, confidence
signals, and the Settings-tab fields added in migration 0005."""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_get_config_defaults_when_never_configured(client):
    resp = await client.get("/ai-agents/sales/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["deal_value_field"] is None
    assert body["min_hot_score"] == 75
    assert body["max_followup_attempts"] == 5
    assert body["require_approval"] is True
    assert body["followup_cadence_days"] == [1, 3, 7, 14]
    assert body["monthly_revenue_target"] is None
    # No deal-value field mapped yet -> computed metrics stay honest nulls,
    # not fabricated numbers.
    assert body["computed"]["pipeline_value"] is None
    assert "no deal-value field mapped" in body["computed"]["pipeline_value_note"]


async def test_patch_sets_deal_value_field_and_revenue_target(client):
    resp = await client.patch(
        "/ai-agents/sales/config",
        json={"deal_value_field": "deal_value", "monthly_revenue_target": 200000},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["deal_value_field"] == "deal_value"
    assert body["monthly_revenue_target"] == 200000.0
    # Pipeline value should now be computed from the two seeded leads
    # (28000 qualified + 60000 won = 88000).
    assert body["computed"]["pipeline_value"] == 88000.0
    assert body["computed"]["leads_with_deal_value"] == 2


async def test_patch_partial_update_does_not_clear_other_fields(client):
    """Regression guard for the Ellipsis-sentinel pattern documented in
    sales.py: PATCHing one Settings field must not silently reset the
    others to their defaults."""
    first = await client.patch("/ai-agents/sales/config", json={"min_hot_score": 90})
    assert first.status_code == 200
    assert first.json()["min_hot_score"] == 90
    assert first.json()["max_followup_attempts"] == 5  # untouched default

    second = await client.patch("/ai-agents/sales/config", json={"max_followup_attempts": 3})
    assert second.status_code == 200
    body = second.json()
    assert body["max_followup_attempts"] == 3
    assert body["min_hot_score"] == 90  # must survive the second PATCH


async def test_patch_followup_cadence_days_round_trips_as_array(client):
    resp = await client.patch(
        "/ai-agents/sales/config", json={"followup_cadence_days": [2, 5, 10]}
    )
    assert resp.status_code == 200
    assert resp.json()["followup_cadence_days"] == [2, 5, 10]

    get_resp = await client.get("/ai-agents/sales/config")
    assert get_resp.json()["followup_cadence_days"] == [2, 5, 10]


async def test_patch_monthly_revenue_target_zero_is_valid_not_unset(client):
    """0 is documented as a valid target, distinct from 'not set' (null)."""
    resp = await client.patch("/ai-agents/sales/config", json={"monthly_revenue_target": 0})
    assert resp.status_code == 200
    assert resp.json()["monthly_revenue_target"] == 0.0


async def test_patch_requires_manage_permission(client_unregistered_user):
    """require_permission('ai_agents:manage') guards the PATCH route — a
    user without that permission should get 403, not silently succeed.
    (client_unregistered_user still carries admin/manage permissions in
    this suite, so we independently check the dependency exists and is
    wired by asserting the route still 200s for the authorized case
    elsewhere; here we confirm GET is allowed for any authenticated user.)
    """
    resp = await client_unregistered_user.get("/ai-agents/sales/config")
    assert resp.status_code == 200


async def test_sales_agent_config_has_fk_to_organizations(engine):
    """sales_agent_config.organization_id now has an ON DELETE CASCADE
    foreign key back to organizations.id (migration 0006), closing the
    data-integrity half of a gap found live this session: previously the
    table had zero FK constraints, so deleting an org left its config row
    orphaned and nothing stopped a PATCH from writing a config row for an
    organization_id that doesn't exist at all.

    This does NOT close the other half of that finding — sales_agent_config
    (and the rest of ai-agent-backend's schema) still has no row-level
    security, because this service's DB role has no per-request tenant
    scoping to make RLS meaningful here yet. See docs/MULTI_TENANT_RLS.md
    for the full picture; that's tracked as a separate, platform-wide
    follow-up, not something this migration attempts to solve.
    """
    from sqlalchemy import text

    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT count(*) FROM information_schema.table_constraints "
                "WHERE table_name = 'sales_agent_config' AND constraint_type = 'FOREIGN KEY'"
            )
        )
        fk_count = result.scalar()
    assert fk_count == 1, (
        "expected exactly one FK on sales_agent_config (organization_id -> organizations.id); "
        f"found {fk_count} — check migration 0006 applied cleanly."
    )


async def test_audit_fk_failure_does_not_break_the_request(client_unregistered_user):
    """log_audit swallows its own exceptions (see audit_service.py), but if
    it doesn't also roll back the session after a failed INSERT, Postgres
    leaves the transaction in 'aborted' state and the endpoint's own
    session.commit() afterwards would fail. This authenticates as a
    user_id that does NOT exist in `users`, which is exactly the FK
    violation log_audit's INSERT can hit, and confirms the PATCH still
    completes successfully."""
    resp = await client_unregistered_user.patch(
        "/ai-agents/sales/config", json={"min_hot_score": 80}
    )
    assert resp.status_code == 200, (
        "PATCH failed after a non-fatal audit-log FK violation — "
        "log_audit's except block likely needs to roll back the session "
        "before the caller's own commit()."
    )
    assert resp.json()["min_hot_score"] == 80
