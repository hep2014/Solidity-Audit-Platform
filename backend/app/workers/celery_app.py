from celery import Celery

from app.core.config import settings


celery_app = Celery(
    "solidity_audit_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.task_track_started = True
celery_app.conf.task_soft_time_limit = settings.celery_task_soft_time_limit_seconds
celery_app.conf.task_time_limit = settings.celery_task_time_limit_seconds
celery_app.conf.worker_prefetch_multiplier = 1
celery_app.conf.task_acks_late = True