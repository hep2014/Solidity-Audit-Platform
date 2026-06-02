from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Callable
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.analysis import Analysis
from app.models.analysis_log import AnalysisLog
from app.models.finding import Finding

from app.services.cfg_service import build_cfg
from app.services.dfg_service import build_dfg
from app.services.echidna_service import run_echidna_scan
from app.services.foundry_service import run_foundry_scan
from app.services.manual_audit_service import generate_manual_audit_checklist
from app.services.mythril_service import run_mythril_scan
from app.services.reentrancy_correlation_service import analyze_reentrancy_correlation
from app.services.slither_service import run_slither_scan
from app.services.solidity_scanner import scan_solidity

from app.workers.celery_app import celery_app
from app.services.finding_normalizer import normalize_finding

from app.core.enums import AnalysisLogStatus, AnalysisStatus

FindingRunner = Callable[[str], list[dict]]


def _get_analysis(db: Session, analysis_id: str) -> Analysis | None:
    return db.query(Analysis).filter(Analysis.id == UUID(analysis_id)).first()

def _get_project_entrypoint(db: Session, analysis: Analysis) -> str:
    project = analysis.project

    if project is None:
        db.refresh(analysis)
        project = analysis.project

    if project and project.entrypoint_path:
        return project.entrypoint_path

    if project:
        return project.file_path

    raise RuntimeError("Analysis project is not available")

def _start_analysis(
    db: Session,
    analysis: Analysis,
    step: str,
) -> None:
    analysis.status = AnalysisStatus.RUNNING.value
    analysis.progress = 10
    analysis.current_step = step

    if analysis.started_at is None:
        analysis.started_at = datetime.now(timezone.utc)

    db.commit()

def _is_cancelled(analysis: Analysis) -> bool:
    return analysis.status == AnalysisStatus.CANCELLED.value


def _finish_analysis_success(db: Session, analysis: Analysis) -> None:
    if _is_cancelled(analysis):
        db.commit()
        return

    analysis.status = AnalysisStatus.SUCCESS.value
    analysis.progress = 100
    analysis.current_step = "completed"
    analysis.finished_at = datetime.now(timezone.utc)
    db.commit()


def _finish_analysis_failed(
    db: Session,
    analysis: Analysis,
    step: str,
) -> None:
    if _is_cancelled(analysis):
        db.commit()
        return

    analysis.status = AnalysisStatus.FAILED.value
    analysis.progress = 100
    analysis.current_step = f"{step}-failed"
    analysis.finished_at = datetime.now(timezone.utc)
    db.commit()


def _create_log(
    db: Session,
    analysis_id: UUID,
    tool: str,
) -> AnalysisLog:
    log = AnalysisLog(
        analysis_id=analysis_id,
        tool=tool,
        status=AnalysisLogStatus.RUNNING.value,
        started_at=datetime.now(timezone.utc),
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return log


def _finish_log(
    db: Session,
    log: AnalysisLog,
    started_perf: float,
    status: str,
    exit_code: int | None = None,
    stdout: str | None = None,
    stderr: str | None = None,
    error_message: str | None = None,
) -> None:
    log.status = status
    log.exit_code = exit_code
    log.stdout = stdout
    log.stderr = stderr
    log.error_message = error_message
    log.finished_at = datetime.now(timezone.utc)
    log.duration_ms = int((perf_counter() - started_perf) * 1000)

    db.commit()


def _save_findings(
    db: Session,
    analysis_id: UUID,
    findings: list[dict],
    default_tool: str,
) -> None:
    for item in findings:
        normalized = normalize_finding(item, default_tool)

        finding = Finding(
            analysis_id=analysis_id,
            severity=normalized["severity"],
            rule=normalized["rule"],
            message=normalized["message"],
            line=normalized["line"],
            tool=normalized["tool"],
        )
        db.add(finding)

    db.commit()


def _run_tool_task(
    *,
    analysis_id: str,
    project_file_path: str,
    step: str,
    tool: str,
    runner: FindingRunner,
) -> None:
    db = SessionLocal()
    started_perf = perf_counter()
    log: AnalysisLog | None = None

    try:
        analysis = _get_analysis(db, analysis_id)

        if analysis is None:
            return

        if _is_cancelled(analysis):
            return

        _start_analysis(db, analysis, step)

        log = _create_log(
            db=db,
            analysis_id=analysis.id,
            tool=tool,
        )

        findings = runner(project_file_path)

        _save_findings(
            db=db,
            analysis_id=analysis.id,
            findings=findings,
            default_tool=tool,
        )

        _finish_log(
            db=db,
            log=log,
            started_perf=started_perf,
            status=AnalysisLogStatus.SUCCESS.value,
            exit_code=0,
            stdout=f"{tool} completed. Findings saved: {len(findings)}",
        )

        _finish_analysis_success(db, analysis)

    except Exception as exc:
        analysis = _get_analysis(db, analysis_id)

        if analysis is not None:
            _finish_analysis_failed(db, analysis, step)

            if log is None:
                log = _create_log(
                    db=db,
                    analysis_id=analysis.id,
                    tool=tool,
                )

            _finish_log(
                db=db,
                log=log,
                started_perf=started_perf,
                status=AnalysisLogStatus.FAILED.value,
                exit_code=-1,
                error_message=str(exc),
            )

        raise

    finally:
        db.close()


def _run_basic_scanner(project_file_path: str) -> list[dict]:
    content = Path(project_file_path).read_text(
        encoding="utf-8",
        errors="ignore",
    )

    return scan_solidity(content)


def _run_manual_checklist(_: str) -> list[dict]:
    return generate_manual_audit_checklist()


@celery_app.task(name="run_basic_task")
def run_basic_task(analysis_id: str, project_file_path: str) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="basic-scanner",
        tool="basic-scanner",
        runner=_run_basic_scanner,
    )


@celery_app.task(name="run_slither_task")
def run_slither_task(analysis_id: str, project_file_path: str) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="slither",
        tool="slither",
        runner=run_slither_scan,
    )


@celery_app.task(name="run_foundry_task")
def run_foundry_task(analysis_id: str, project_file_path: str) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="foundry",
        tool="foundry",
        runner=run_foundry_scan,
    )


@celery_app.task(name="run_mythril_task")
def run_mythril_task(analysis_id: str, project_file_path: str) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="mythril",
        tool="mythril",
        runner=run_mythril_scan,
    )


@celery_app.task(name="run_echidna_task")
def run_echidna_task(analysis_id: str, project_file_path: str) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="echidna",
        tool="echidna",
        runner=run_echidna_scan,
    )


@celery_app.task(name="run_cfg_task")
def run_cfg_task(analysis_id: str, project_file_path: str) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="cfg",
        tool="cfg",
        runner=build_cfg,
    )


@celery_app.task(name="run_dfg_task")
def run_dfg_task(analysis_id: str, project_file_path: str) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="dfg",
        tool="dfg",
        runner=build_dfg,
    )


@celery_app.task(name="run_reentrancy_correlation_task")
def run_reentrancy_correlation_task(
    analysis_id: str,
    project_file_path: str,
) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="reentrancy-correlation",
        tool="custom-cfg-dfg",
        runner=analyze_reentrancy_correlation,
    )


@celery_app.task(name="run_manual_checklist_task")
def run_manual_checklist_task(
    analysis_id: str,
    project_file_path: str,
) -> None:
    _run_tool_task(
        analysis_id=analysis_id,
        project_file_path=project_file_path,
        step="manual-audit-checklist",
        tool="manual-audit",
        runner=_run_manual_checklist,
    )

def _run_full_step(
    *,
    db: Session,
    analysis: Analysis,
    project_file_path: str,
    step: str,
    tool: str,
    runner: FindingRunner,
    progress: int,
) -> None:
    analysis.status = AnalysisStatus.RUNNING.value
    analysis.progress = progress
    analysis.current_step = step
    db.commit()

    if analysis.started_at is None:
        analysis.started_at = datetime.now(timezone.utc)

    started_perf = perf_counter()

    log = _create_log(
        db=db,
        analysis_id=analysis.id,
        tool=tool,
    )

    try:
        findings = runner(project_file_path)

        _save_findings(
            db=db,
            analysis_id=analysis.id,
            findings=findings,
            default_tool=tool,
        )

        _finish_log(
            db=db,
            log=log,
            started_perf=started_perf,
            status=AnalysisLogStatus.SUCCESS.value,
            exit_code=0,
            stdout=f"{tool} completed. Findings saved: {len(findings)}",
        )

    except Exception as exc:
        _finish_log(
            db=db,
            log=log,
            started_perf=started_perf,
            status=AnalysisLogStatus.FAILED.value,
            exit_code=-1,
            error_message=str(exc),
        )

        _save_findings(
            db=db,
            analysis_id=analysis.id,
            findings=[
                {
                    "severity": "medium",
                    "rule": f"{tool.upper()}_EXECUTION_ERROR",
                    "message": str(exc),
                    "line": None,
                    "tool": tool,
                }
            ],
            default_tool=tool,
        )

@celery_app.task(name="run_full_task")
def run_full_task(analysis_id: str, project_file_path: str) -> None:
    db = SessionLocal()

    try:
        analysis = _get_analysis(db, analysis_id)

        if analysis is None:
            return

        pipeline = [
            ("basic-scanner", "basic-scanner", _run_basic_scanner, 10),
            ("slither", "slither", run_slither_scan, 25),
            ("foundry", "foundry", run_foundry_scan, 40),
            ("mythril", "mythril", run_mythril_scan, 55),
            ("echidna", "echidna", run_echidna_scan, 70),
            ("cfg", "cfg", build_cfg, 80),
            ("dfg", "dfg", build_dfg, 88),
            (
                "reentrancy-correlation",
                "custom-cfg-dfg",
                analyze_reentrancy_correlation,
                94,
            ),
            (
                "manual-audit-checklist",
                "manual-audit",
                _run_manual_checklist,
                98,
            ),
        ]

        failed_steps = 0

        for step, tool, runner, progress in pipeline:
            db.refresh(analysis)

            if _is_cancelled(analysis):
                analysis.progress = 100
                analysis.current_step = "cancelled"
                db.commit()
                return

            _run_full_step(
                db=db,
                analysis=analysis,
                project_file_path=project_file_path,
                step=step,
                tool=tool,
                runner=runner,
                progress=progress,
            )

            latest_log = (
                db.query(AnalysisLog)
                .filter(AnalysisLog.analysis_id == analysis.id)
                .order_by(AnalysisLog.created_at.desc())
                .first()
            )

            if latest_log and latest_log.status == AnalysisLogStatus.FAILED.value:
                failed_steps += 1

        analysis.progress = 100
        analysis.current_step = "completed"
        analysis.finished_at = datetime.now(timezone.utc)

        if failed_steps == 0:
            analysis.status = AnalysisStatus.SUCCESS.value
        else:
            analysis.status = AnalysisStatus.PARTIAL_SUCCESS.value

        db.commit()

    except Exception:
        analysis = _get_analysis(db, analysis_id)

        if analysis is not None:
            analysis.status = AnalysisStatus.FAILED.value
            analysis.progress = 100
            analysis.current_step = "full-analysis-failed"
            analysis.finished_at = datetime.now(timezone.utc)
            db.commit()

        raise

    finally:
        db.close()