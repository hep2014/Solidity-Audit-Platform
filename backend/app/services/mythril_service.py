import shlex
from pathlib import Path

from app.core.config import settings
from app.services.docker_runner import DockerRunner


EXCLUDED_DIRS = {
    "test",
    "tests",
    "script",
    "scripts",
    "lib",
    "node_modules",
    "out",
    "cache",
    "broadcast",
}


def _build_message(stdout: str, stderr: str, exit_code: int, timed_out: bool = False) -> str:
    parts = [f"Exit code: {exit_code}"]

    if timed_out:
        parts.append("Timed out: true")

    if stdout.strip():
        parts.append(f"STDOUT:\n{stdout.strip()}")

    if stderr.strip():
        parts.append(f"STDERR:\n{stderr.strip()}")

    return "\n\n".join(parts)


def _severity_from_mythril_result(ok: bool, timed_out: bool = False) -> str:
    if timed_out:
        return "medium"

    return "info" if ok else "medium"


def _is_excluded_sol_file(path: Path, workspace_dir: Path) -> bool:
    relative_parts = path.relative_to(workspace_dir).parts
    return any(part in EXCLUDED_DIRS for part in relative_parts)


def _collect_solidity_targets(file_path: Path) -> tuple[Path, list[str]]:
    if file_path.is_dir():
        workspace_dir = file_path

        sol_files = [
            sol_file.relative_to(workspace_dir).as_posix()
            for sol_file in workspace_dir.rglob("*.sol")
            if not _is_excluded_sol_file(sol_file, workspace_dir)
        ]

        return workspace_dir, sorted(sol_files)

    if file_path.name == "foundry.toml":
        workspace_dir = file_path.parent

        sol_files = [
            sol_file.relative_to(workspace_dir).as_posix()
            for sol_file in workspace_dir.rglob("*.sol")
            if not _is_excluded_sol_file(sol_file, workspace_dir)
        ]

        return workspace_dir, sorted(sol_files)

    workspace_dir = file_path.parent
    return workspace_dir, [file_path.name]


def run_mythril_scan(project_file_path: str) -> list[dict]:
    file_path = Path(project_file_path).resolve()

    if not file_path.exists():
        return [
            {
                "severity": "high",
                "rule": "MYTHRIL_FILE_NOT_FOUND",
                "message": f"Project file not found: {file_path}",
                "line": None,
                "tool": "mythril",
            }
        ]

    workspace_dir, target_files = _collect_solidity_targets(file_path)

    if not target_files:
        return [
            {
                "severity": "medium",
                "rule": "MYTHRIL_NO_SOLIDITY_FILES",
                "message": (
                    "No Solidity files found for Mythril analysis. "
                    "Test, script, lib, out and cache directories are skipped."
                ),
                "line": None,
                "tool": "mythril",
            }
        ]

    runner = DockerRunner(
        image=settings.mythril_image,
        timeout_seconds=240,
    )

    findings: list[dict] = []

    for target_file in target_files:
        workspace_target = f"/workspace/{target_file}"
        quoted_workspace_target = shlex.quote(workspace_target)

        command = [
            "bash",
            "-lc",
            (
                "set -e; "
                "export HOME=/tmp; "
                "export TMPDIR=/tmp; "
                "export SOLC=/usr/local/bin/solc; "
                "mkdir -p /tmp/mythril; "
                "echo 'Using solc:'; "
                "which solc; "
                "solc --version; "
                f"echo 'Analyzing: {quoted_workspace_target}'; "
                f"myth analyze {quoted_workspace_target} "
                "--execution-timeout 60 "
                "--parallel-solving"
            ),
        ]

        result = runner.run(
            project_path=workspace_dir,
            command=command,
        )

        rule = "MYTHRIL_TIMEOUT" if result.timed_out else "MYTHRIL_SYMBOLIC_EXECUTION"

        findings.append(
            {
                "severity": _severity_from_mythril_result(
                    ok=result.ok,
                    timed_out=result.timed_out,
                ),
                "rule": rule,
                "message": (
                    f"Target file: {target_file}\n\n"
                    + _build_message(
                        stdout=result.stdout,
                        stderr=result.stderr,
                        exit_code=result.exit_code,
                        timed_out=result.timed_out,
                    )
                ),
                "line": None,
                "tool": "mythril",
            }
        )

    return findings