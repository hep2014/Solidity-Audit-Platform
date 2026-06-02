from collections import Counter
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.analysis import Analysis
from app.models.analysis_log import AnalysisLog
from app.models.finding import Finding
from app.models.project import Project


SEVERITY_WEIGHT = {
    "critical": 5,
    "high": 4,
    "medium": 3,
    "low": 2,
    "info": 1,
}


def _severity_rank(severity: str) -> int:
    return SEVERITY_WEIGHT.get((severity or "").lower(), 0)


def _sort_findings(findings: list[Finding]) -> list[Finding]:
    return sorted(
        findings,
        key=lambda finding: (
            -_severity_rank(finding.severity),
            finding.tool or "",
            finding.rule or "",
            finding.line if finding.line is not None else 10**9,
            str(finding.id),
        ),
    )


def build_analysis_report(db: Session, analysis_id: UUID) -> dict | None:
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()

    if analysis is None:
        return None

    project = db.query(Project).filter(Project.id == analysis.project_id).first()

    findings = (
        db.query(Finding)
        .filter(Finding.analysis_id == analysis_id)
        .all()
    )

    logs = (
        db.query(AnalysisLog)
        .filter(AnalysisLog.analysis_id == analysis_id)
        .order_by(AnalysisLog.created_at.asc())
        .all()
    )

    sorted_findings = _sort_findings(findings)

    by_severity = Counter(finding.severity for finding in sorted_findings)
    by_tool = Counter(finding.tool for finding in sorted_findings)

    return {
        "analysis": analysis,
        "project": project,
        "summary": {
            "total": len(sorted_findings),
            "by_severity": dict(sorted(by_severity.items())),
            "by_tool": dict(sorted(by_tool.items())),
        },
        "findings": sorted_findings,
        "logs": logs,
    }