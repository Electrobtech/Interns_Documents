"""Domain exception hierarchy + RFC 7807 problem+json rendering (§19).

Uniform errors across ten services matter more than in a monolith: the frontend
and every internal client should be able to handle a failure the same way
regardless of which service produced it.
"""
from __future__ import annotations

from typing import Any


class OrbqError(Exception):
    """Base for all Orbq domain errors."""

    status_code: int = 500
    error_type: str = "internal-error"
    title: str = "Internal Server Error"

    def __init__(self, detail: str | None = None, **extra: Any) -> None:
        self.detail = detail or self.title
        self.extra = extra
        super().__init__(self.detail)

    def to_problem(self, *, trace_id: str | None = None, instance: str | None = None) -> dict:
        problem = {
            "type": f"https://errors.orbq.ai/{self.error_type}",
            "title": self.title,
            "status": self.status_code,
            "detail": self.detail,
        }
        if instance:
            problem["instance"] = instance
        if trace_id:
            problem["trace_id"] = trace_id
        problem.update(self.extra)
        return problem


# ---- 4xx -------------------------------------------------------------------


class ValidationError(OrbqError):
    status_code = 422
    error_type = "validation-failed"
    title = "Validation Failed"


class NotFoundError(OrbqError):
    status_code = 404
    error_type = "not-found"
    title = "Resource Not Found"


class UnauthorizedError(OrbqError):
    status_code = 401
    error_type = "unauthorized"
    title = "Unauthorized"


class ForbiddenError(OrbqError):
    status_code = 403
    error_type = "forbidden"
    title = "Forbidden"


class ConflictError(OrbqError):
    status_code = 409
    error_type = "conflict"
    title = "Conflict"


class QuotaExceededError(OrbqError):
    status_code = 429
    error_type = "quota-exceeded"
    title = "AI Quota Exceeded"


class RateLimitedError(OrbqError):
    status_code = 429
    error_type = "rate-limited"
    title = "Rate Limit Exceeded"


class TenantContextMissingError(OrbqError):
    status_code = 500
    error_type = "tenant-context-missing"
    title = "Tenant Context Missing"


# ---- 5xx / dependency ------------------------------------------------------


class DependencyUnavailableError(OrbqError):
    status_code = 503
    error_type = "dependency-unavailable"
    title = "Upstream Dependency Unavailable"

    def __init__(self, dependency: str, detail: str | None = None) -> None:
        super().__init__(
            detail or f"{dependency} is unavailable", dependency=dependency
        )


class CircuitOpenError(DependencyUnavailableError):
    error_type = "circuit-open"
    title = "Circuit Breaker Open"


class LLMError(OrbqError):
    status_code = 502
    error_type = "llm-error"
    title = "LLM Provider Error"


class LLMOutputInvalidError(LLMError):
    """The model returned something that would not validate against the
    capability's output schema, even after a repair attempt.

    Surfaced rather than swallowed: silently returning a partial object is how
    an agent ends up confidently reporting a field it never produced.
    """

    error_type = "llm-output-invalid"
    title = "LLM Output Failed Schema Validation"


class ApprovalRequiredError(OrbqError):
    """Raised when a side-effecting action is attempted without approval (§12.3)."""

    status_code = 409
    error_type = "approval-required"
    title = "Approval Required"


class CapabilityError(OrbqError):
    status_code = 500
    error_type = "capability-failed"
    title = "Capability Execution Failed"

    def __init__(self, capability: str, detail: str | None = None) -> None:
        super().__init__(
            detail or f"Capability {capability} failed", capability=capability
        )
