from celery import Celery

from app.core.config import settings


celery_app = Celery(
    "solidity_audit_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.tasks",
    ],
)

celery_app.conf.update(
    broker_url=settings.redis_url,
    result_backend=settings.redis_url,
    task_track_started=True,
    task_soft_time_limit=settings.celery_task_soft_time_limit_seconds,
    task_time_limit=settings.celery_task_time_limit_seconds,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)