from datetime import datetime, timezone
from time import perf_counter
from typing import Callable
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.analysis_log import AnalysisLog


def create_analysis_log(
    db: Session,
    analysis_id: UUID,
    tool: str,
    status: str = "RUNNING",
) -> AnalysisLog:
    log = AnalysisLog(
        analysis_id=analysis_id,
        tool=tool,
        status=status,
        started_at=datetime.now(timezone.utc),
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return log


def finish_analysis_log(
    db: Session,
    log: AnalysisLog,
    status: str,
    exit_code: int | None = None,
    stdout: str | None = None,
    stderr: str | None = None,
    error_message: str | None = None,
    started_perf: float | None = None,
) -> AnalysisLog:
    log.status = status
    log.exit_code = exit_code
    log.stdout = stdout
    log.stderr = stderr
    log.error_message = error_message
    log.finished_at = datetime.now(timezone.utc)

    if started_perf is not None:
        log.duration_ms = int((perf_counter() - started_perf) * 1000)

    db.commit()
    db.refresh(log)

    return log