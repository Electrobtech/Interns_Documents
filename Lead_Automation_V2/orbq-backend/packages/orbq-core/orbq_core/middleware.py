"""ASGI middleware shared by every Orbq service.

Order matters and is fixed in `install_middleware`:
    request-id → error-handler → authentication+tenant

Request-id is outermost so that even an auth failure carries a trace id the
user can quote in a support ticket.
"""
from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import BaseServiceSettings
from sqlalchemy.exc import IntegrityError

from .errors import OrbqError, UnauthorizedError
from .security import decode_token, extract_bearer, tenant_from_claims
from .tenancy import (
    INTERNAL_SIGNATURE_HEADER,
    INTERNAL_TENANT_HEADER,
    reset_tenant_context,
    set_tenant_context,
    verify_tenant_context,
)

log = structlog.get_logger()

# Paths that never require authentication.
PUBLIC_PATHS = frozenset(
    {
        "/health/live", "/health/ready", "/health/startup", "/metrics",
        "/docs", "/openapi.json", "/redoc",
        # Static capability manifest — no tenant data, needed before any request exists.
        "/internal/capabilities",
    }
)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Correlation id + access log + duration header."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.state.request_id = request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id, path=request.url.path, method=request.method
        )

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - started) * 1000
            log.exception("request_failed", duration_ms=round(duration_ms, 2))
            raise

        duration_ms = (time.perf_counter() - started) * 1000
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"

        # Health checks fire constantly; logging them buries real traffic.
        if request.url.path not in PUBLIC_PATHS:
            log.info(
                "request_completed",
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )
        return response


# Constraint name -> the message a user can act on. Anything not listed falls
# through to the generic 500 rather than guessing at a friendly wording for a
# constraint whose meaning we haven't considered.
_UNIQUE_CONSTRAINT_MESSAGES = {
    "uq_seo_projects_org_name": "An SEO project with that name already exists.",
    "uq_aeo_projects_org_name": "An AEO project with that name already exists.",
    "uq_marketing_templates_org_name": "A template with that name already exists.",
    "uq_marketing_competitors_org_name": "That competitor is already being tracked.",
    "uq_campaign_recipient_once": "That contact is already queued for this campaign message.",
    "uq_broadcast_recipient_once": "That contact is already queued for this broadcast.",
    "uq_content_version": "That content version has already been recorded.",
}


def _unique_violation_message(exc: IntegrityError) -> str | None:
    """Returns an actionable message for a known unique violation, else None
    so the caller re-raises into the generic handler."""
    text = str(getattr(exc, "orig", exc))
    if "UniqueViolation" not in text and "duplicate key" not in text:
        return None
    for constraint, message in _UNIQUE_CONSTRAINT_MESSAGES.items():
        if constraint in text:
            return message
    return "That value is already in use."


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Render every failure as RFC 7807 problem+json (§19)."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        trace_id = getattr(request.state, "request_id", None)
        try:
            return await call_next(request)
        except OrbqError as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content=exc.to_problem(trace_id=trace_id, instance=str(request.url.path)),
                media_type="application/problem+json",
            )
        except IntegrityError as exc:
            # A unique-constraint violation is the user re-using a name, not a
            # server fault. Reported as a 500 it reads as "the product is
            # broken"; as a 409 it reads as "pick another name" — which is what
            # actually happened, and is actionable.
            conflict = _unique_violation_message(exc)
            if conflict is None:
                raise
            log.info("integrity_conflict", detail=conflict)
            return JSONResponse(
                status_code=409,
                content={
                    "type": "https://errors.orbq.ai/conflict",
                    "title": "Conflict",
                    "status": 409,
                    "detail": conflict,
                    "trace_id": trace_id,
                    "instance": str(request.url.path),
                },
                media_type="application/problem+json",
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("unhandled_error", error=str(exc))
            # Never leak internals to the client; the trace id is the bridge to
            # the full stack trace in the logs.
            return JSONResponse(
                status_code=500,
                content={
                    "type": "https://errors.orbq.ai/internal-error",
                    "title": "Internal Server Error",
                    "status": 500,
                    "detail": "An unexpected error occurred.",
                    "trace_id": trace_id,
                },
                media_type="application/problem+json",
            )


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """Layer 1 of tenant isolation (§17.2).

    Accepts either an end-user JWT (edge traffic) or a signed internal tenant
    header (service-to-service). The internal path is checked first because
    inter-service calls forward the original user's context rather than
    re-deriving it.
    """

    def __init__(self, app: FastAPI, settings: BaseServiceSettings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        internal_payload = request.headers.get(INTERNAL_TENANT_HEADER)
        internal_sig = request.headers.get(INTERNAL_SIGNATURE_HEADER)

        if internal_payload and internal_sig:
            ctx = verify_tenant_context(
                internal_payload, internal_sig, self.settings.internal_signing_key
            )
        else:
            token = extract_bearer(request.headers.get("Authorization"))
            claims = decode_token(
                token,
                secret=self.settings.jwt_secret,
                algorithm=self.settings.jwt_algorithm,
            )
            ctx = tenant_from_claims(claims, workspace=request.headers.get("X-Orbq-Workspace"))

        request.state.tenant = ctx
        structlog.contextvars.bind_contextvars(
            org_id=str(ctx.org_id), user_id=str(ctx.user_id)
        )

        token_ref = set_tenant_context(ctx)
        try:
            return await call_next(request)
        finally:
            # Must reset even on error, or a pooled worker task could inherit
            # the previous request's tenant.
            reset_tenant_context(token_ref)


def install_middleware(app: FastAPI, settings: BaseServiceSettings) -> None:
    """Install in the correct order.

    Starlette applies middleware in reverse registration order, so the last
    added is outermost. Registering tenant → error → request-id yields an
    effective chain of request-id → error → tenant.
    """
    app.add_middleware(TenantIsolationMiddleware, settings=settings)
    app.add_middleware(ErrorHandlerMiddleware)
    app.add_middleware(RequestContextMiddleware)
