"""Writes to the platform's shared audit_logs table (same one the Node
services use via @lead/shared's logAudit) — one unified audit trail across
the whole platform. Failures never break the request being audited."""
from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def log_audit(session: AsyncSession, organization_id: uuid.UUID, user_id: str, action: str, meta: dict) -> None:
    try:
        await session.execute(
            text("INSERT INTO audit_logs (organization_id, user_id, action, meta) VALUES (:org, :user, :action, :meta)"),
            {"org": str(organization_id), "user": user_id, "action": action, "meta": json.dumps(meta)},
        )
    except Exception:
        logger.warning("audit_log_write_failed action=%s", action, exc_info=True)
