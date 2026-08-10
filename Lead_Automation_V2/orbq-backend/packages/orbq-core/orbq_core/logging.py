"""structlog configuration. Every line carries trace_id, org_id, service."""
from __future__ import annotations

import logging
import sys

import structlog

from .config import BaseServiceSettings


def configure_logging(settings: BaseServiceSettings) -> None:
    logging.basicConfig(
        format="%(message)s", stream=sys.stdout, level=settings.log_level.upper()
    )

    # Third-party loggers are noisy at INFO and bury our own signal.
    for noisy in ("httpx", "httpcore", "sqlalchemy.engine.Engine", "aiormq", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        _add_service(settings.service_name),
    ]

    if settings.log_json:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def _add_service(service_name: str):
    def processor(_logger, _method, event_dict):
        event_dict.setdefault("service", service_name)
        return event_dict

    return processor
