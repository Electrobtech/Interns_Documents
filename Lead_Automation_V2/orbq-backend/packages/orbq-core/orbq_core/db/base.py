"""Declarative base + the mixins that make §16.3's table conventions structural.

Every Orbq table in every service inherits these, so audit columns, soft delete,
and the tenant key cannot be forgotten on a new table.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, MetaData, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Explicit naming convention so Alembic autogenerate produces stable, readable
# constraint names instead of database-assigned ones that churn between runs.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_N_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ActorMixin:
    created_by: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class VersionMixin:
    """Optimistic locking for mutable aggregates."""

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    __mapper_args__ = {"version_id_col": None}  # services opt in explicitly


class TenantMixin:
    """The tenant key. Indexed, and the leading column of composite indexes.

    Note there is no ForeignKey to an organizations table: organizations are
    owned by the Node auth-service, in a different database (ADR-001 / §16.4).
    Integrity is maintained by reconciliation, not by a constraint.
    """

    org_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), nullable=False, index=True
    )


class WorkspaceMixin:
    """Second scoping dimension within an org (§17.4)."""

    workspace: Mapped[str] = mapped_column(String(16), nullable=False, index=True)


class OrbqTable(
    Base,
    UUIDPrimaryKeyMixin,
    TenantMixin,
    TimestampMixin,
    ActorMixin,
    SoftDeleteMixin,
):
    """The standard Orbq table shape. Abstract — services subclass it.

    `eager_defaults=True` matters more here than the SQLAlchemy docs suggest:
    `updated_at` uses a server-side `onupdate=func.now()`, so after any UPDATE
    the ORM has no Python-side value for it and marks the attribute expired,
    expecting a follow-up SELECT on next access. Under async SQLAlchemy there
    is no implicit lazy load — that access crashes with MissingGreenlet the
    moment a router builds a response from a row it just updated. With this
    flag, Postgres's UPDATE ... RETURNING fetches the value inline instead.
    """

    __abstract__ = True
    __mapper_args__ = {"eager_defaults": True}

    @classmethod
    def tenant_index(cls, *columns: str, name: str | None = None) -> Index:
        """Build an org_id-leading composite index.

        Always leading with org_id is what makes the index usable for the
        tenant-filtered queries that TenantScopedRepository generates — an index
        on (status, org_id) would not be.
        """
        idx_name = name or f"ix_{cls.__tablename__}_org_{'_'.join(columns)}"
        return Index(idx_name, "org_id", *columns)
