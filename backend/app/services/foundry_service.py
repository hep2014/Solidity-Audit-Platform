import shlex
from pathlib import Path

from app.core.config import settings
from app.services.docker_runner import DockerRunner


def _severity_from_foundry_result(ok: bool) -> str:
    return "info" if ok else "high"


def _build_message(stdout: str, stderr: str, exit_code: int, timed_out: bool = False) -> str:
    parts = [f"Exit code: {exit_code}"]

    if timed_out:
        parts.append("Timed out: true")

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

    workspace_dir = file_path.parent

    if file_path.name == "foundry.toml":
        target_file = None
    else:
        target_file = file_path.name

    runner = DockerRunner(
        image=settings.foundry_image,
        timeout_seconds=240,
    )

    common_env = (
        "set -e; "
        "export HOME=/tmp; "
        "export TMPDIR=/tmp; "
        "export FOUNDRY_CACHE_PATH=/tmp/foundry-cache; "
        "export FOUNDRY_OUT=/tmp/foundry-out; "
        "mkdir -p /tmp/foundry-cache /tmp/foundry-out; "
    )

    if _is_foundry_project(workspace_dir):
        command = [
            "bash",
            "-lc",
            (
                common_env
                + "rm -rf /tmp/foundry_project; "
                "mkdir -p /tmp/foundry_project; "
                "cp -r /workspace/. /tmp/foundry_project/; "
                "cd /tmp/foundry_project; "
                "mkdir -p lib; "
                "if [ ! -d lib/forge-std ] && [ -d /opt/foundry-libs/forge-std ]; then "
                "cp -r /opt/foundry-libs/forge-std lib/forge-std; "
                "fi; "
                "echo 'Using solc:'; "
                "which solc; "
                "solc --version; "
                "forge build --use /usr/local/bin/solc; "
                "forge test --use /usr/local/bin/solc -vvv"
            ),
        ]
    else:
        if target_file is None:
            return [
                {
                    "severity": "medium",
                    "rule": "FOUNDRY_TARGET_NOT_FOUND",
                    "message": "Foundry target file was not resolved.",
                    "line": None,
                    "tool": "foundry",
                }
            ]

        quoted_target_file = shlex.quote(target_file)

        command = [
            "bash",
            "-lc",
            (
                common_env
                + "rm -rf /tmp/foundry_check; "
                "mkdir -p /tmp/foundry_check/src; "
                "cd /tmp/foundry_check; "
                "cat > foundry.toml <<'EOF'\n"
                "[profile.default]\n"
                "src = 'src'\n"
                "out = 'out'\n"
                "libs = ['lib']\n"
                "solc = 'solc'\n"
                "EOF\n"
                f"cp /workspace/{quoted_target_file} src/{quoted_target_file}; "
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

    rule = "FOUNDRY_TIMEOUT" if result.timed_out else "FOUNDRY_BUILD_AND_TEST"

    return [
        {
            "severity": _severity_from_foundry_result(result.ok),
            "rule": rule,
            "message": _build_message(
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.exit_code,
                timed_out=result.timed_out,
            ),
            "line": None,
            "tool": "foundry",
        }
    ]