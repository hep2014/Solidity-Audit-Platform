import json
import shlex
from pathlib import Path

from app.core.config import settings
from app.services.docker_runner import DockerRunner


def _extract_json_from_stdout(stdout: str) -> dict | None:
    if not stdout.strip():
        return None

    start = stdout.find("{")
    end = stdout.rfind("}")

    if start == -1 or end == -1 or end <= start:
        return None

    try:
        return json.loads(stdout[start : end + 1])
    except json.JSONDecodeError:
        return None


def _map_slither_impact_to_severity(impact: str | None) -> str:
    if not impact:
        return "info"

    impact = impact.lower()

    if impact == "high":
        return "high"
    if impact == "medium":
        return "medium"
    if impact == "low":
        return "low"
    if impact in {"informational", "optimization"}:
        return "info"

    return "info"


def _extract_line(detector: dict) -> int | None:
    elements = detector.get("elements") or []

    for element in elements:
        source_mapping = element.get("source_mapping") or {}
        lines = source_mapping.get("lines") or []

        if lines:
            return lines[0]

    return None


def _normalize_detector(detector: dict) -> dict:
    check = detector.get("check") or "unknown"
    impact = detector.get("impact")
    confidence = detector.get("confidence") or "unknown"

    description = detector.get("description") or ""
    markdown = detector.get("markdown") or ""

    line = _extract_line(detector)

    message_parts = []

    if description:
        message_parts.append(description.strip())

    if markdown and markdown != description:
        message_parts.append(markdown.strip())

    message_parts.append(f"Confidence: {confidence}")

    return {
        "severity": _map_slither_impact_to_severity(impact),
        "rule": check,
        "message": "\n\n".join(message_parts),
        "line": line,
        "tool": "slither",
    }

EXCLUDED_PROJECT_DIRS = {
    "lib",
    "node_modules",
    "out",
    "cache",
    "broadcast",
}


def _find_foundry_root(path: Path) -> Path | None:
    if path.is_file() and path.name == "foundry.toml":
        return path.parent

    if path.is_file():
        candidate = path.parent / "foundry.toml"
        return path.parent if candidate.exists() else None

    direct_candidate = path / "foundry.toml"

    if direct_candidate.exists():
        return path

    for foundry_toml in path.rglob("foundry.toml"):
        relative_parts = foundry_toml.relative_to(path).parts

        if any(part in EXCLUDED_PROJECT_DIRS for part in relative_parts):
            continue

        return foundry_toml.parent

    return None


def run_slither_scan(project_file_path: str) -> list[dict]:
    file_path = Path(project_file_path).resolve()

    foundry_root = _find_foundry_root(file_path)

    if foundry_root is not None:
        workspace_dir = foundry_root
        target_file = "."
    elif file_path.is_dir():
        workspace_dir = file_path
        target_file = "."
    elif file_path.name == "foundry.toml":
        workspace_dir = file_path.parent
        target_file = "."
    else:
        workspace_dir = file_path.parent
        target_file = file_path.name

    quoted_target_file = shlex.quote(target_file)

    command = [
        "bash",
        "-lc",
        (
            "set +e; "
            "export HOME=/tmp; "
            "export TMPDIR=/tmp; "
            "export SOLC=/usr/local/bin/solc; "
            "export FOUNDRY_SOLC=/usr/local/bin/solc; "
            "export FOUNDRY_OFFLINE=true; "
            "export FOUNDRY_CACHE_PATH=/tmp/foundry-cache; "
            "export FOUNDRY_OUT=/tmp/foundry-out; "
            "mkdir -p /tmp/slither /tmp/foundry-cache /tmp/foundry-out; "
            "echo 'Using forge:' 1>&2; "
            "which forge 1>&2; "
            "forge --version 1>&2; "
            "echo 'Using solc:' 1>&2; "
            "which solc 1>&2; "
            "solc --version 1>&2; "
            f"slither {quoted_target_file} "
            "--solc /usr/local/bin/solc "
            "--json /tmp/slither/slither-report.json "
            "> /tmp/slither/slither-stdout.log "
            "2> /tmp/slither/slither-stderr.log; "
            "code=$?; "
            "if [ -f /tmp/slither/slither-report.json ]; then "
            "cat /tmp/slither/slither-report.json; "
            "else "
            "cat /tmp/slither/slither-stdout.log 2>/dev/null || true; "
            "cat /tmp/slither/slither-stderr.log 1>&2 2>/dev/null || true; "
            "fi; "
            "exit $code"
        ),
    ]

    runner = DockerRunner(
        image=settings.slither_image,
        timeout_seconds=180,
    )

    result = runner.run(
        project_path=workspace_dir,
        command=command,
    )

    if result.timed_out:
        return [
            {
                "severity": "medium",
                "rule": "SLITHER_TIMEOUT",
                "message": (
                    "Slither analysis timed out.\n\n"
                    f"STDOUT:\n{result.stdout}\n\n"
                    f"STDERR:\n{result.stderr}"
                ),
                "line": None,
                "tool": "slither",
            }
        ]

    report = _extract_json_from_stdout(result.stdout)

    if report is None:
        return [
            {
                "severity": "medium",
                "rule": "SLITHER_EXECUTION_ERROR",
                "message": (
                    "Slither did not return valid JSON.\n\n"
                    f"Exit code: {result.exit_code}\n\n"
                    f"STDOUT:\n{result.stdout}\n\n"
                    f"STDERR:\n{result.stderr}"
                ),
                "line": None,
                "tool": "slither",
            }
        ]

    detectors = report.get("results", {}).get("detectors", [])

    findings = [_normalize_detector(detector) for detector in detectors]

    if not findings:
        findings.append(
            {
                "severity": "info",
                "rule": "SLITHER_NO_FINDINGS",
                "message": "Slither completed successfully and returned no detector findings.",
                "line": None,
                "tool": "slither",
            }
        )

    return findings