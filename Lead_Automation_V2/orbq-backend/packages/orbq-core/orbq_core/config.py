"""Shared settings base.

Every Orbq service subclasses ``BaseServiceSettings`` and adds its own fields.
Keeping the common ones here means a change to, say, the JWT algorithm is one
edit rather than ten.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseServiceSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ---- identity ----------------------------------------------------------
    service_name: str = "orbq-service"
    environment: Literal["local", "ci", "staging", "production"] = "local"
    debug: bool = False

    # ---- datastores --------------------------------------------------------
    database_url: PostgresDsn
    redis_url: RedisDsn = Field(default="redis://redis:6379/0")
    rabbitmq_url: str = Field(default="amqp://guest:guest@rabbitmq:5672//")

    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_echo: bool = False

    # ---- auth --------------------------------------------------------------
    # HS256 with a secret shared with the Node `auth-service` (shared/src/auth.js).
    # See ADR-011 / open question 2 — RS256 is the recommended Phase 4 upgrade so
    # Orbq holds only a public key and cannot mint tokens.
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # Signs the internal tenant-context header so one Orbq service cannot forge
    # an org_id when calling another (§17.2).
    internal_signing_key: str

    # ---- observability -----------------------------------------------------
    log_level: str = "INFO"
    log_json: bool = True
    otel_endpoint: str | None = None
    otel_enabled: bool = False

    # ---- resilience defaults (§7.4) ---------------------------------------
    http_connect_timeout: float = 3.0
    http_read_timeout: float = 10.0
    http_max_retries: int = 2
    circuit_breaker_threshold: int = 5
    circuit_breaker_reset_seconds: float = 30.0

    @field_validator("jwt_secret", "internal_signing_key")
    @classmethod
    def _reject_placeholder_secrets(cls, v: str, info) -> str:
        """A placeholder secret in production is a total auth bypass, so fail loudly."""
        weak = {"change-me-in-prod", "changeme", "secret", "dev", ""}
        if v.strip().lower() in weak:
            # Only hard-fail outside local/ci — local dev needs a usable default.
            import os

            if os.getenv("ENVIRONMENT", "local") in {"staging", "production"}:
                raise ValueError(
                    f"{info.field_name} is a placeholder value; refusing to start"
                )
        return v

    @property
    def sqlalchemy_url(self) -> str:
        """asyncpg driver URL. Accepts a plain postgres:// for compose parity."""
        url = str(self.database_url)
        if url.startswith("postgresql+asyncpg://"):
            return url
        return url.replace("postgres://", "postgresql+asyncpg://", 1).replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )


@lru_cache
def get_settings_cached(cls: type[BaseServiceSettings]) -> BaseServiceSettings:
    return cls()
