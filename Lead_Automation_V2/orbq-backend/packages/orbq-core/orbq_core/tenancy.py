"""Tenant isolation — layers 1 and 2 of the four-layer defense (§17.2).

This module exists so that tenant filtering is implemented exactly once for all
ten services. Services must not write their own data-access primitives; with a
shared-schema multi-tenant model, one forgotten ``WHERE org_id = ...`` is a
cross-tenant data leak.

Layer 3 (Postgres RLS) is applied in `database.py`, which sets the
``app.current_org_id`` GUC per transaction from the context established here.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Any, Generic, Iterator, Sequence, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .errors import ForbiddenError, TenantContextMissingError

# ---------------------------------------------------------------------------
# Tenant context
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class TenantContext:
    """The authenticated caller's tenant + identity, derived from the JWT.

    Frozen because nothing downstream should ever mutate the org being acted on.
    """

    org_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    permissions: frozenset[str]
    workspace: str | None = None  # marketing | sales | support

    def require_permission(self, code: str) -> None:
        if code not in self.permissions:
            raise ForbiddenError(f"Missing required permission: {code}")

    def has_permission(self, code: str) -> bool:
        return code in self.permissions


_tenant_ctx: ContextVar[TenantContext | None] = ContextVar("orbq_tenant", default=None)


def set_tenant_context(ctx: TenantContext) -> Token:
    return _tenant_ctx.set(ctx)


def reset_tenant_context(token: Token) -> None:
    _tenant_ctx.reset(token)


def current_tenant() -> TenantContext:
    """The active tenant, or raise. Never returns None — callers must not guess."""
    ctx = _tenant_ctx.get()
    if ctx is None:
        raise TenantContextMissingError(
            "No tenant context bound to this execution. A request path is "
            "missing TenantIsolationMiddleware, or a worker task did not call "
            "bind_tenant()."
        )
    return ctx


def current_tenant_optional() -> TenantContext | None:
    return _tenant_ctx.get()


@contextmanager
def bind_tenant(ctx: TenantContext) -> Iterator[TenantContext]:
    """Bind a tenant for a block. Used by Celery tasks and event consumers,
    which have no HTTP middleware to do it for them."""
    token = set_tenant_context(ctx)
    try:
        yield ctx
    finally:
        reset_tenant_context(token)


# ---------------------------------------------------------------------------
# Signed internal tenant propagation (§17.2 / §18.2)
# ---------------------------------------------------------------------------

INTERNAL_TENANT_HEADER = "X-Orbq-Tenant"
INTERNAL_SIGNATURE_HEADER = "X-Orbq-Tenant-Signature"


def sign_tenant_context(ctx: TenantContext, signing_key: str) -> tuple[str, str]:
    """Serialize + HMAC a tenant context for a service-to-service call.

    Without the signature, any service that can reach another could claim an
    arbitrary org_id — so a single compromised service would read every tenant's
    data. The receiving service verifies before trusting.
    """
    payload = json.dumps(
        {
            "org_id": str(ctx.org_id),
            "user_id": str(ctx.user_id),
            "role": ctx.role,
            "permissions": sorted(ctx.permissions),
            "workspace": ctx.workspace,
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    signature = hmac.new(
        signing_key.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    return payload, signature


def verify_tenant_context(
    payload: str, signature: str, signing_key: str
) -> TenantContext:
    expected = hmac.new(
        signing_key.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ForbiddenError("Invalid internal tenant signature")

    data = json.loads(payload)
    return TenantContext(
        org_id=uuid.UUID(data["org_id"]),
        user_id=uuid.UUID(data["user_id"]),
        role=data["role"],
        permissions=frozenset(data.get("permissions", [])),
        workspace=data.get("workspace"),
    )


# ---------------------------------------------------------------------------
# Layer 2 — the repository chokepoint
# ---------------------------------------------------------------------------

T = TypeVar("T")


class TenantScopedRepository(Generic[T]):
    """Base for every repository in every service.

    All reads go through `_scoped()`, which applies the org filter and the
    soft-delete filter. Services are forbidden (by import-linter contract) from
    importing ORM models directly, so there is no path to an unfiltered query
    that does not go through this class.
    """

    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # -- query construction --------------------------------------------------

    def _scoped(self, *, include_deleted: bool = False) -> Select:
        ctx = current_tenant()
        stmt = select(self.model).where(self.model.org_id == ctx.org_id)  # type: ignore[attr-defined]
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))  # type: ignore[attr-defined]
        return stmt

    # -- reads ---------------------------------------------------------------

    async def get(self, entity_id: uuid.UUID, *, include_deleted: bool = False) -> T | None:
        stmt = self._scoped(include_deleted=include_deleted).where(
            self.model.id == entity_id  # type: ignore[attr-defined]
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_or_raise(self, entity_id: uuid.UUID) -> T:
        from .errors import NotFoundError

        entity = await self.get(entity_id)
        if entity is None:
            # Deliberately identical to the message for "exists but other org" —
            # distinguishing them leaks the existence of another tenant's row.
            raise NotFoundError(f"{self.model.__name__} {entity_id} not found")
        return entity

    async def list(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        order_desc: bool = True,
        include_deleted: bool = False,
    ) -> Sequence[T]:
        stmt = self._scoped(include_deleted=include_deleted)
        if hasattr(self.model, "created_at"):
            col = self.model.created_at  # type: ignore[attr-defined]
            stmt = stmt.order_by(col.desc() if order_desc else col.asc())
        stmt = stmt.limit(limit).offset(offset)
        return (await self.session.execute(stmt)).scalars().all()

    async def count(self, *, include_deleted: bool = False) -> int:
        ctx = current_tenant()
        stmt = select(func.count()).select_from(self.model).where(
            self.model.org_id == ctx.org_id  # type: ignore[attr-defined]
        )
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))  # type: ignore[attr-defined]
        return (await self.session.execute(stmt)).scalar_one()

    # -- writes --------------------------------------------------------------

    async def add(self, entity: T) -> T:
        """Stamp tenant + actor from context rather than trusting the caller."""
        ctx = current_tenant()
        entity.org_id = ctx.org_id  # type: ignore[attr-defined]
        if hasattr(entity, "created_by") and getattr(entity, "created_by", None) is None:
            entity.created_by = ctx.user_id  # type: ignore[attr-defined]
        self.session.add(entity)
        await self.session.flush()
        return entity

    async def soft_delete(self, entity_id: uuid.UUID) -> None:
        """Soft delete, always. An execution trace citing a hard-deleted document
        would break explainability retroactively (§16.3)."""
        from datetime import datetime, timezone

        entity = await self.get_or_raise(entity_id)
        ctx = current_tenant()
        entity.deleted_at = datetime.now(timezone.utc)  # type: ignore[attr-defined]
        if hasattr(entity, "updated_by"):
            entity.updated_by = ctx.user_id  # type: ignore[attr-defined]
        await self.session.flush()


def assert_same_tenant(*entities: Any) -> None:
    """Guard for code paths that join objects loaded separately."""
    ctx = current_tenant()
    for entity in entities:
        org_id = getattr(entity, "org_id", None)
        if org_id is not None and org_id != ctx.org_id:
            raise ForbiddenError("Cross-tenant object access blocked")
