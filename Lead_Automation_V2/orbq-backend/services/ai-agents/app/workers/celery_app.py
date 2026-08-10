"""Celery app — Phase 11.

Separate queues matter (§4.1): a 200-page PDF ingestion must never delay an
interactive support reply. Ingestion is slow and CPU/IO-heavy; agent work is
latency-sensitive. They get different queues and can be scaled independently.
"""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from ..config import get_settings

settings = get_settings()

celery_app = Celery(
    "orbq_ai_agents",
    broker=settings.rabbitmq_url,
    backend=str(settings.redis_url),
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="pickle",  # tasks carry raw file bytes
    accept_content=["pickle", "json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,          # redeliver if a worker dies mid-task
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # long tasks: don't hoard the queue
    task_track_started=True,
    result_expires=3600,
    task_routes={
        "app.workers.tasks.ingest_document": {"queue": "ingestion"},
        "app.workers.tasks.run_agent_async": {"queue": "agent"},
        "app.workers.tasks.advance_workflow": {"queue": "workflow"},
        "app.workers.tasks.consolidate_memory": {"queue": "events"},
        "app.workers.tasks.decay_memory": {"queue": "events"},
        "app.workers.tasks.create_partitions": {"queue": "events"},
    },
    task_default_queue="events",
)

celery_app.conf.beat_schedule = {
    # Summarize finished sessions, promote durable facts short → long (§14).
    "consolidate-memory-hourly": {
        "task": "app.workers.tasks.consolidate_memory",
        "schedule": crontab(minute=15),
    },
    # Decay unused memories so stale beliefs stop influencing prompts.
    "decay-memory-nightly": {
        "task": "app.workers.tasks.decay_memory",
        "schedule": crontab(hour=3, minute=0),
    },
    # Create next month's partitions ahead of time. A missing partition is an
    # outage, and discovering that at midnight on the 1st is a bad night (§16.5).
    "create-partitions-weekly": {
        "task": "app.workers.tasks.create_partitions",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),
    },
}
