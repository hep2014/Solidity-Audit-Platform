from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.enums import AnalysisStatus
from app.models.analysis import Analysis
from app.models.analysis_log import AnalysisLog
from app.models.finding import Finding
from app.models.project import Project
from app.schemas.analysis import AnalysisLogRead, AnalysisRead, FindingRead
from app.schemas.report import AnalysisReport
from app.services.report_service import build_analysis_report
from app.workers.celery_app import celery_app
from app.workers.tasks import (
    run_basic_task,
    run_cfg_task,
    run_dfg_task,
    run_echidna_task,
    run_foundry_task,
    run_full_task,
    run_manual_checklist_task,
    run_mythril_task,
    run_reentrancy_correlation_task,
    run_slither_task,
)


router = APIRouter(prefix="/api/analyses", tags=["analyses"])

ACTIVE_STATUSES = {
    AnalysisStatus.PENDING.value,
    AnalysisStatus.RUNNING.value,
}

TERMINAL_STATUSES = {
    AnalysisStatus.SUCCESS.value,
    AnalysisStatus.FAILED.value,
    AnalysisStatus.PARTIAL_SUCCESS.value,
    AnalysisStatus.CANCELLED.value,
    AnalysisStatus.TIMEOUT.value,
}

TASK_BY_MODE = {
    "basic": (run_basic_task, "basic-scanner-queued"),
    "slither": (run_slither_task, "slither-queued"),
    "foundry": (run_foundry_task, "foundry-queued"),
    "mythril": (run_mythril_task, "mythril-queued"),
    "echidna": (run_echidna_task, "echidna-queued"),
    "cfg": (run_cfg_task, "cfg-queued"),
    "dfg": (run_dfg_task, "dfg-queued"),
    "reentrancy-correlation": (
        run_reentrancy_correlation_task,
        "reentrancy-correlation-queued",
    ),
    "manual-checklist": (
        run_manual_checklist_task,
        "manual-audit-checklist-queued",
    ),
    "full": (run_full_task, "full-analysis-queued"),
}

MODE_BY_TOOL = {
    "basic-scanner": "basic",
    "slither": "slither",
    "foundry": "foundry",
    "mythril": "mythril",
    "echidna": "echidna",
    "cfg": "cfg",
    "dfg": "dfg",
    "custom-cfg-dfg": "reentrancy-correlation",
    "manual-audit": "manual-checklist",
}


def _get_project_or_404(project_id: UUID, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    file_path = Path(project.file_path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Project file not found on disk")

    return project


def _get_analysis_or_404(analysis_id: UUID, db: Session) -> Analysis:
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()

    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return analysis


def _ensure_no_active_analysis(
    *,
    db: Session,
    project_id: UUID,
    force: bool,
) -> None:
    if force:
        return

    active_analysis = (
        db.query(Analysis)
        .filter(
            Analysis.project_id == project_id,
            Analysis.status.in_(ACTIVE_STATUSES),
        )
        .order_by(Analysis.created_at.desc())
        .first()
    )

    if active_analysis is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Project already has an active analysis. Use force=true to start another one.",
                "analysis_id": str(active_analysis.id),
                "status": active_analysis.status,
                "current_step": active_analysis.current_step,
            },
        )


def _create_pending_analysis(
    db: Session,
    project: Project,
    current_step: str,
) -> Analysis:
    analysis = Analysis(
        project_id=project.id,
        status=AnalysisStatus.PENDING.value,
        progress=0,
        current_step=current_step,
    )

    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return analysis


def _enqueue_analysis(
    *,
    project_id: UUID,
    db: Session,
    current_step: str,
    task,
    force: bool = False,
) -> Analysis:
    project = _get_project_or_404(project_id, db)

    _ensure_no_active_analysis(
        db=db,
        project_id=project.id,
        force=force,
    )

    analysis = _create_pending_analysis(
        db=db,
        project=project,
        current_step=current_step,
    )

    async_result = task.delay(str(analysis.id))

    analysis.celery_task_id = async_result.id
    db.commit()
    db.refresh(analysis)

    return analysis


def _detect_retry_mode(db: Session, analysis: Analysis) -> str:
    logs = (
        db.query(AnalysisLog)
        .filter(AnalysisLog.analysis_id == analysis.id)
        .order_by(AnalysisLog.created_at.asc())
        .all()
    )

    if len(logs) > 1:
        return "full"

    if len(logs) == 1:
        return MODE_BY_TOOL.get(logs[0].tool, "full")

    current_step = analysis.current_step or ""

    if "full" in current_step:
        return "full"
    if "slither" in current_step:
        return "slither"
    if "foundry" in current_step:
        return "foundry"
    if "mythril" in current_step:
        return "mythril"
    if "echidna" in current_step:
        return "echidna"
    if "cfg" in current_step and "reentrancy" not in current_step:
        return "cfg"
    if "dfg" in current_step and "reentrancy" not in current_step:
        return "dfg"
    if "reentrancy" in current_step:
        return "reentrancy-correlation"
    if "manual" in current_step:
        return "manual-checklist"
    if "basic" in current_step:
        return "basic"

    return "full"


@router.post("/{project_id}/run-basic", response_model=AnalysisRead)
def run_basic_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="basic-scanner-queued",
        task=run_basic_task,
        force=force,
    )


@router.post("/{project_id}/run-slither", response_model=AnalysisRead)
def run_slither_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="slither-queued",
        task=run_slither_task,
        force=force,
    )


@router.post("/{project_id}/run-foundry", response_model=AnalysisRead)
def run_foundry_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="foundry-queued",
        task=run_foundry_task,
        force=force,
    )


@router.post("/{project_id}/run-mythril", response_model=AnalysisRead)
def run_mythril_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="mythril-queued",
        task=run_mythril_task,
        force=force,
    )


@router.post("/{project_id}/run-echidna", response_model=AnalysisRead)
def run_echidna_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="echidna-queued",
        task=run_echidna_task,
        force=force,
    )


@router.post("/{project_id}/run-cfg", response_model=AnalysisRead)
def run_cfg_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="cfg-queued",
        task=run_cfg_task,
        force=force,
    )


@router.post("/{project_id}/run-dfg", response_model=AnalysisRead)
def run_dfg_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="dfg-queued",
        task=run_dfg_task,
        force=force,
    )


@router.post("/{project_id}/run-reentrancy-correlation", response_model=AnalysisRead)
def run_reentrancy_correlation_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="reentrancy-correlation-queued",
        task=run_reentrancy_correlation_task,
        force=force,
    )


@router.post("/{project_id}/run-manual-checklist", response_model=AnalysisRead)
def run_manual_audit_checklist(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="manual-audit-checklist-queued",
        task=run_manual_checklist_task,
        force=force,
    )


@router.post("/{project_id}/run-full", response_model=AnalysisRead)
def run_full_analysis(
    project_id: UUID,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="full-analysis-queued",
        task=run_full_task,
        force=force,
    )


@router.get("/{analysis_id}", response_model=AnalysisRead)
def get_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    return _get_analysis_or_404(analysis_id, db)


@router.get("/{analysis_id}/findings", response_model=list[FindingRead])
def get_analysis_findings(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    _get_analysis_or_404(analysis_id, db)

    return (
        db.query(Finding)
        .filter(Finding.analysis_id == analysis_id)
        .order_by(Finding.created_at.asc())
        .all()
    )


@router.get("/{analysis_id}/logs", response_model=list[AnalysisLogRead])
def get_analysis_logs(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    _get_analysis_or_404(analysis_id, db)

    return (
        db.query(AnalysisLog)
        .filter(AnalysisLog.analysis_id == analysis_id)
        .order_by(AnalysisLog.created_at.asc())
        .all()
    )


@router.get("/{analysis_id}/report", response_model=AnalysisReport)
def get_analysis_report(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    report = build_analysis_report(db, analysis_id)

    if report is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return report


@router.post("/{analysis_id}/cancel", response_model=AnalysisRead)
def cancel_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)

    if analysis.status in TERMINAL_STATUSES:
        return analysis

    if analysis.celery_task_id:
        celery_app.control.revoke(
            analysis.celery_task_id,
            terminate=True,
            signal="SIGTERM",
        )

    analysis.status = AnalysisStatus.CANCELLED.value
    analysis.progress = 100
    analysis.current_step = "cancelled"

    db.commit()
    db.refresh(analysis)

    return analysis


@router.post("/{analysis_id}/retry", response_model=AnalysisRead)
def retry_analysis(
    analysis_id: UUID,
    mode: str | None = Query(default=None),
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)

    if analysis.status not in TERMINAL_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="Only terminal analyses can be retried",
        )

    project = _get_project_or_404(analysis.project_id, db)

    retry_mode = mode or _detect_retry_mode(db, analysis)

    if retry_mode not in TASK_BY_MODE:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown retry mode: {retry_mode}",
        )

    task, current_step = TASK_BY_MODE[retry_mode]

    return _enqueue_analysis(
        project_id=project.id,
        db=db,
        current_step=current_step,
        task=task,
        force=force,
    )


@router.delete("/{analysis_id}")
def delete_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)

    if analysis.status in ACTIVE_STATUSES and analysis.celery_task_id:
        celery_app.control.revoke(
            analysis.celery_task_id,
            terminate=True,
            signal="SIGTERM",
        )

    db.delete(analysis)
    db.commit()

    return {
        "status": "deleted",
        "analysis_id": str(analysis_id),
    }


@router.get("/project/{project_id}", response_model=list[AnalysisRead])
def get_project_analyses(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    return (
        db.query(Analysis)
        .filter(Analysis.project_id == project_id)
        .order_by(Analysis.created_at.desc())
        .all()
    )