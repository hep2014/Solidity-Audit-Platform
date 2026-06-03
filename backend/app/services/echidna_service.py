import shlex
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


def _build_message(
    stdout: str,
    stderr: str,
    exit_code: int,
    timed_out: bool = False,
) -> str:
    parts = [f"Exit code: {exit_code}"]

    if timed_out:
        parts.append("Timed out: true")

    if stdout.strip():
        parts.append(f"STDOUT:\n{stdout.strip()}")

    if stderr.strip():
        parts.append(f"STDERR:\n{stderr.strip()}")

    return "\n\n".join(parts)


def _severity_from_echidna_result(ok: bool, timed_out: bool = False) -> str:
    if timed_out:
        return "medium"

    return "info" if ok else "high"


def _is_excluded_sol_file(path: Path, workspace_dir: Path) -> bool:
    relative_parts = path.relative_to(workspace_dir).parts
    return any(part in EXCLUDED_DIRS for part in relative_parts)


def _find_solidity_files(workspace_dir: Path) -> list[Path]:
    return sorted(
        sol_file
        for sol_file in workspace_dir.rglob("*.sol")
        if not _is_excluded_sol_file(sol_file, workspace_dir)
    )


def _find_echidna_config(workspace_dir: Path) -> Path | None:
    for name in ECHIDNA_CONFIG_NAMES:
        candidate = workspace_dir / name

        if candidate.exists():
            return candidate

    for config_name in ECHIDNA_CONFIG_NAMES:
        for candidate in workspace_dir.rglob(config_name):
            relative_parts = candidate.relative_to(workspace_dir).parts

            if any(part in EXCLUDED_DIRS for part in relative_parts):
                continue

            return candidate

    return None


def _find_project_root(path: Path) -> Path:
    """
    Supports both archive layouts:

    1. /uploads/<project_id>/foundry.toml
       /uploads/<project_id>/echidna.yaml
       /uploads/<project_id>/src/...

    2. /uploads/<project_id>/vuln-test/foundry.toml
       /uploads/<project_id>/vuln-test/echidna.yaml
       /uploads/<project_id>/vuln-test/src/...
    """
    if path.is_file():
        return path.parent

    direct_markers = [
        path / "echidna.yaml",
        path / "echidna.yml",
        path / "foundry.toml",
        path / "src",
    ]

    if any(marker.exists() for marker in direct_markers):
        return path

    for config_name in ECHIDNA_CONFIG_NAMES:
        for config_path in path.rglob(config_name):
            relative_parts = config_path.relative_to(path).parts

            if any(part in EXCLUDED_DIRS for part in relative_parts):
                continue

            return config_path.parent

    for foundry_toml in path.rglob("foundry.toml"):
        relative_parts = foundry_toml.relative_to(path).parts

        if any(part in EXCLUDED_DIRS for part in relative_parts):
            continue

        return foundry_toml.parent

    return path


def _resolve_workspace_and_target(file_path: Path) -> tuple[Path, str] | tuple[None, None]:
    if file_path.suffix == ".sol":
        workspace_dir = file_path.parent
        target_file = file_path.name
        return workspace_dir, target_file

    workspace_dir = _find_project_root(file_path)
    sol_files = _find_solidity_files(workspace_dir)

    if not sol_files:
        return None, None

    config_path = _find_echidna_config(workspace_dir)

    if config_path is not None:
        config_text = config_path.read_text(encoding="utf-8", errors="ignore")

        for sol_file in sol_files:
            relative_path = sol_file.relative_to(workspace_dir).as_posix()

            if relative_path in config_text or sol_file.name in config_text:
                return workspace_dir, relative_path

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

    quoted_target_file = shlex.quote(target_file)
    quoted_relative_config = shlex.quote(relative_config)
    quoted_target_dir = shlex.quote(str(Path(target_file).parent))

    runner = DockerRunner(
        image=settings.echidna_image,
        timeout_seconds=300,
        memory_limit="2g",
    )

    command = [
        "bash",
        "-lc",
        (
            "set -e; "
            "export PATH=/usr/local/bin:$PATH; "
            "export SOLC=/usr/local/bin/solc; "
            "export HOME=/tmp; "
            "export TMPDIR=/tmp; "
            "mkdir -p /tmp/echidna-cache; "
            "rm -rf /tmp/echidna_project; "
            "mkdir -p /tmp/echidna_project; "

            "if [ -d /workspace/src ]; then "
            "cp -r /workspace/src /tmp/echidna_project/src; "
            "fi; "

            f"mkdir -p /tmp/echidna_project/$(dirname {quoted_relative_config}); "
            f"cp /workspace/{quoted_relative_config} "
            f"/tmp/echidna_project/{quoted_relative_config}; "

            f"if [ -f /workspace/{quoted_target_file} ]; then "
            f"mkdir -p /tmp/echidna_project/{quoted_target_dir}; "
            f"cp /workspace/{quoted_target_file} "
            f"/tmp/echidna_project/{quoted_target_file}; "
            "fi; "

            "cd /tmp/echidna_project; "

            "echo 'Using solc:'; "
            "which solc || true; "
            "solc --version || true; "

            f"echo 'Running Echidna target: {quoted_target_file}'; "
            f"echo 'Using Echidna config: {quoted_relative_config}'; "
            f"echidna {quoted_target_file} "
            f"--config {quoted_relative_config} "
            "--workers 1 "
            "--test-limit 5000 "
            "--shrink-limit 200"
        ),
    ]

    result = runner.run(
        project_path=workspace_dir,
        command=command,
    )

    rule = "ECHIDNA_TIMEOUT" if result.timed_out else "ECHIDNA_PROPERTY_BASED_FUZZING"

    return [
        {
            "severity": _severity_from_echidna_result(
                ok=result.ok,
                timed_out=result.timed_out,
            ),
            "rule": rule,
            "message": (
                f"Workspace: {workspace_dir}\n"
                f"Target file: {target_file}\n"
                f"Config file: {relative_config}\n\n"
                + _build_message(
                    stdout=result.stdout,
                    stderr=result.stderr,
                    exit_code=result.exit_code,
                    timed_out=result.timed_out,
                )
            ),
            "line": None,
            "tool": "echidna",
        }
    ]