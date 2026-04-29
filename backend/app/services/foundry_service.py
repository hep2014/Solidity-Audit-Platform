from pathlib import Path

from app.services.docker_runner import DockerRunner
from app.core.config import settings

def _severity_from_foundry_result(ok: bool) -> str:
    return "info" if ok else "high"


def _build_message(stdout: str, stderr: str, exit_code: int) -> str:
    parts = [f"Exit code: {exit_code}"]

    if stdout.strip():
        parts.append(f"STDOUT:\n{stdout.strip()}")

    if stderr.strip():
        parts.append(f"STDERR:\n{stderr.strip()}")

    return "\n\n".join(parts)


def _is_foundry_project(workspace_dir: Path) -> bool:
    return (workspace_dir / "foundry.toml").exists()


def run_foundry_scan(project_file_path: str) -> list[dict]:
    file_path = Path(project_file_path).resolve()

    if not file_path.exists():
        return [
            {
                "severity": "high",
                "rule": "FOUNDRY_FILE_NOT_FOUND",
                "message": f"Project file not found: {file_path}",
                "line": None,
                "tool": "foundry",
            }
        ]

    if file_path.name == "foundry.toml":
        workspace_dir = file_path.parent
        target_file = None
    else:
        workspace_dir = file_path.parent
        target_file = file_path.name

    runner = DockerRunner(
        image=settings.foundry_image,
        timeout_seconds=240,
    )

    if _is_foundry_project(workspace_dir):
        command = [
            "bash",
            "-lc",
            (
                "set -e; "
                "rm -rf /tmp/foundry_project; "
                "mkdir -p /tmp/foundry_project; "
                "cp -r /workspace/. /tmp/foundry_project/; "
                "cd /tmp/foundry_project; "
                "mkdir -p lib; "
                "if [ ! -d lib/forge-std ]; then cp -r /opt/foundry-libs/forge-std lib/forge-std; fi; "
                "echo 'Using solc:'; "
                "which solc; "
                "solc --version; "
                "forge build --use /usr/local/bin/solc; "
                "forge test --use /usr/local/bin/solc -vvv"
            ),
        ]
    else:
        command = [
            "bash",
            "-lc",
            (
                "set -e; "
                "rm -rf /tmp/foundry_check; "
                "mkdir -p /tmp/foundry_check/src; "
                "cd /tmp/foundry_check; "
                "cat > foundry.toml <<'EOF'\n"
                "[profile.default]\n"
                "src = 'src'\n"
                "out = 'out'\n"
                "libs = ['lib']\n"
                "solc = 'solc'\n"
                "EOF\n"
                f"cp /workspace/{target_file} src/{target_file}; "
                "echo 'Using solc:'; "
                "which solc; "
                "solc --version; "
                "forge build --use /usr/local/bin/solc; "
                "forge test --use /usr/local/bin/solc -vvv"
            ),
        ]

    result = runner.run(
        project_path=workspace_dir,
        command=command,
    )

    return [
        {
            "severity": _severity_from_foundry_result(result.ok),
            "rule": "FOUNDRY_BUILD_AND_TEST",
            "message": _build_message(
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.exit_code,
            ),
            "line": None,
            "tool": "foundry",
        }
    ]