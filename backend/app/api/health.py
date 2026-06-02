from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import SessionLocal
from app.workers.celery_app import celery_app


router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live():
    return {"status": "ok"}


@router.get("/ready")
def ready():
    checks = {
        "database": False,
        "redis": False,
    }

    db = SessionLocal()

    try:
        db.execute(text("SELECT 1"))
        checks["database"] = True
    finally:
        db.close()

    try:
        with celery_app.connection_for_read() as connection:
            connection.ensure_connection(max_retries=1)
        checks["redis"] = True
    except Exception:
        checks["redis"] = False

    status = "ok" if all(checks.values()) else "degraded"

    return {
        "status": status,
        "checks": checks,
    }