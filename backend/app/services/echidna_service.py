from pathlib import Path

from app.core.config import settings
from app.services.docker_runner import DockerRunner


ECHIDNA_CONFIG_NAMES = (
    "echidna.yaml",
    "echidna.yml",
    "echidna.config.yaml",
    "echidna.config.yml",
)

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


def _severity_from_echidna_result(ok: bool) -> str:
    return "info" if ok else "high"


def _find_echidna_config(workspace_dir: Path) -> Path | None:
    for name in ECHIDNA_CONFIG_NAMES:
        candidate = workspace_dir / name
        if candidate.exists():
            return candidate

    return None


def _is_excluded_sol_file(path: Path, workspace_dir: Path) -> bool:
    relative_parts = path.relative_to(workspace_dir).parts
    return any(part in EXCLUDED_DIRS for part in relative_parts)


def _find_solidity_files(workspace_dir: Path) -> list[Path]:
    return sorted(
        sol_file
        for sol_file in workspace_dir.rglob("*.sol")
        if not _is_excluded_sol_file(sol_file, workspace_dir)
    )


def _resolve_workspace_and_target(file_path: Path) -> tuple[Path, str] | tuple[None, None]:
    if file_path.suffix == ".sol":
        workspace_dir = file_path.parent
        target_file = file_path.name
        return workspace_dir, target_file

    workspace_dir = file_path.parent
    sol_files = _find_solidity_files(workspace_dir)

    if not sol_files:
        return None, None

    target_file = sol_files[0].relative_to(workspace_dir).as_posix()
    return workspace_dir, target_file


def run_echidna_scan(project_file_path: str) -> list[dict]:
    file_path = Path(project_file_path).resolve()

    if not file_path.exists():
        return [
            {
                "severity": "high",
                "rule": "ECHIDNA_FILE_NOT_FOUND",
                "message": f"Project file not found: {file_path}",
                "line": None,
                "tool": "echidna",
            }
        ]

    workspace_dir, target_file = _resolve_workspace_and_target(file_path)

    if workspace_dir is None or target_file is None:
        return [
            {
                "severity": "medium",
                "rule": "ECHIDNA_NO_SOLIDITY_FILES",
                "message": "No Solidity files were found for Echidna analysis.",
                "line": None,
                "tool": "echidna",
            }
        ]

    config_path = _find_echidna_config(workspace_dir)

    if config_path is None:
        return [
            {
                "severity": "info",
                "rule": "ECHIDNA_CONFIG_NOT_FOUND",
                "message": (
                    "Echidna config was not found. "
                    "Add echidna.yaml or echidna.yml to project root."
                ),
                "line": None,
                "tool": "echidna",
            }
        ]

    relative_config = config_path.relative_to(workspace_dir).as_posix()

    runner = DockerRunner(
        image=settings.echidna_image,
        timeout_seconds=300,
    )

    command = [
        "bash",
        "-lc",
        (
            "set -e; "
            "export PATH=/usr/local/bin:$PATH; "
            "export SOLC=/usr/local/bin/solc; "

            "rm -rf /tmp/echidna_project; "
            "mkdir -p /tmp/echidna_project; "

            # ВАЖНО:
            # не копируем foundry.toml, out, cache, lib, test.
            # Иначе Echidna включает crytic-compile foundry mode и вызывает forge.
            "if [ -d /workspace/src ]; then cp -r /workspace/src /tmp/echidna_project/src; fi; "
            f"cp /workspace/{relative_config} /tmp/echidna_project/{relative_config}; "

            # Если загружен одиночный .sol в корне, копируем его отдельно.
            f"if [ -f /workspace/{target_file} ]; then "
            f"mkdir -p /tmp/echidna_project/$(dirname {target_file}); "
            f"cp /workspace/{target_file} /tmp/echidna_project/{target_file}; "
            "fi; "

            "cd /tmp/echidna_project; "

            "echo 'Using solc:'; "
            "which solc || true; "
            "solc --version || true; "

            f"echo 'Running Echidna target: {target_file}'; "
            f"echidna {target_file} --config {relative_config}"
        ),
    ]

    result = runner.run(
        project_path=workspace_dir,
        command=command,
    )

    return [
        {
            "severity": _severity_from_echidna_result(result.ok),
            "rule": "ECHIDNA_PROPERTY_BASED_FUZZING",
            "message": (
                f"Target file: {target_file}\n\n"
                + _build_message(
                    stdout=result.stdout,
                    stderr=result.stderr,
                    exit_code=result.exit_code,
                )
            ),
            "line": None,
            "tool": "echidna",
        }
    ]