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


def _build_message(stdout: str, stderr: str, exit_code: int) -> str:
    parts = [f"Exit code: {exit_code}"]

    if stdout.strip():
        parts.append(f"STDOUT:\n{stdout.strip()}")

    if stderr.strip():
        parts.append(f"STDERR:\n{stderr.strip()}")

    return "\n\n".join(parts)


def _severity_from_mythril_result(ok: bool) -> str:
    return "info" if ok else "medium"


def _is_excluded_sol_file(path: Path, workspace_dir: Path) -> bool:
    relative_parts = path.relative_to(workspace_dir).parts
    return any(part in EXCLUDED_DIRS for part in relative_parts)


def _collect_solidity_targets(file_path: Path) -> tuple[Path, list[str]]:
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
                "message": "No Solidity files found for Mythril analysis. Test, script, lib, out and cache directories are skipped.",
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
        command = [
            "bash",
            "-lc",
            (
                "set -e; "
                "export SOLC=/usr/local/bin/solc; "
                "echo 'Using solc:'; "
                "which solc; "
                "solc --version; "
                f"echo 'Analyzing: /workspace/{target_file}'; "
                f"myth analyze /workspace/{target_file} "
                "--solv 0.8.20 "
                "--execution-timeout 60 "
                "--parallel-solving"
            ),
        ]

        result = runner.run(
            project_path=workspace_dir,
            command=command,
        )

        findings.append(
            {
                "severity": _severity_from_mythril_result(result.ok),
                "rule": "MYTHRIL_SYMBOLIC_EXECUTION",
                "message": (
                    f"Target file: {target_file}\n\n"
                    + _build_message(
                        stdout=result.stdout,
                        stderr=result.stderr,
                        exit_code=result.exit_code,
                    )
                ),
                "line": None,
                "tool": "mythril",
            }
        )

    return findings