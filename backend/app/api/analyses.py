from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.analysis import Analysis
from app.models.analysis_log import AnalysisLog
from app.models.finding import Finding
from app.models.project import Project
from app.schemas.analysis import AnalysisLogRead, AnalysisRead, FindingRead

from app.workers.tasks import (
    run_basic_task,
    run_slither_task,
    run_foundry_task,
    run_mythril_task,
    run_echidna_task,
    run_cfg_task,
    run_dfg_task,
    run_reentrancy_correlation_task,
    run_manual_checklist_task,
    run_full_task,
)


router = APIRouter(prefix="/api/analyses", tags=["analyses"])


def _get_project_or_404(project_id: UUID, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    file_path = Path(project.file_path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Project file not found on disk")

    return project


def _create_pending_analysis(
    db: Session,
    project: Project,
    current_step: str,
) -> Analysis:
    analysis = Analysis(
        project_id=project.id,
        status="PENDING",
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
) -> Analysis:
    project = _get_project_or_404(project_id, db)

    analysis = _create_pending_analysis(
        db=db,
        project=project,
        current_step=current_step,
    )

    task.delay(
        str(analysis.id),
        project.file_path,
    )

    return analysis


@router.post("/{project_id}/run-basic", response_model=AnalysisRead)
def run_basic_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="basic-scanner-queued",
        task=run_basic_task,
    )


@router.post("/{project_id}/run-slither", response_model=AnalysisRead)
def run_slither_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="slither-queued",
        task=run_slither_task,
    )


@router.post("/{project_id}/run-foundry", response_model=AnalysisRead)
def run_foundry_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="foundry-queued",
        task=run_foundry_task,
    )


@router.post("/{project_id}/run-mythril", response_model=AnalysisRead)
def run_mythril_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="mythril-queued",
        task=run_mythril_task,
    )


@router.post("/{project_id}/run-echidna", response_model=AnalysisRead)
def run_echidna_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="echidna-queued",
        task=run_echidna_task,
    )


@router.post("/{project_id}/run-cfg", response_model=AnalysisRead)
def run_cfg_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="cfg-queued",
        task=run_cfg_task,
    )


@router.post("/{project_id}/run-dfg", response_model=AnalysisRead)
def run_dfg_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="dfg-queued",
        task=run_dfg_task,
    )


@router.post("/{project_id}/run-reentrancy-correlation", response_model=AnalysisRead)
def run_reentrancy_correlation_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="reentrancy-correlation-queued",
        task=run_reentrancy_correlation_task,
    )


@router.post("/{project_id}/run-manual-checklist", response_model=AnalysisRead)
def run_manual_audit_checklist(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="manual-audit-checklist-queued",
        task=run_manual_checklist_task,
    )


@router.get("/{analysis_id}", response_model=AnalysisRead)
def get_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()

    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return analysis


@router.get("/{analysis_id}/findings", response_model=list[FindingRead])
def get_analysis_findings(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()

    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

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
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()

    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return (
        db.query(AnalysisLog)
        .filter(AnalysisLog.analysis_id == analysis_id)
        .order_by(AnalysisLog.created_at.asc())
        .all()
    )


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

@router.post("/{project_id}/run-full", response_model=AnalysisRead)
def run_full_analysis(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return _enqueue_analysis(
        project_id=project_id,
        db=db,
        current_step="full-analysis-queued",
        task=run_full_task,
    )