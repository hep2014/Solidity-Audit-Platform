import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings


@dataclass
class DockerRunResult:
    ok: bool
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False


class DockerRunner:
    def __init__(
        self,
        image: str | None = None,
        timeout_seconds: int | None = None,
    ):
        if image is None:
            raise ValueError("DockerRunner image must be provided")

        self.image = image
        self.timeout_seconds = timeout_seconds or settings.analyzer_timeout_seconds

    def run(
        self,
        project_path: str | Path,
        command: list[str],
    ) -> DockerRunResult:
        project_path = Path(project_path).resolve()

        if not project_path.exists():
            return DockerRunResult(
                ok=False,
                exit_code=-1,
                stdout="",
                stderr=f"Project path does not exist: {project_path}",
            )

        docker_command = [
            "docker",
            "run",
            "--rm",

            "--network",
            "none",

            "--cpus",
            "1",
            "--memory",
            "1g",
            "--pids-limit",
            "256",

            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",

            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=256m",
            "--tmpfs",
            "/workspace-cache:rw,noexec,nosuid,size=512m",

            "-e",
            "HOME=/tmp",
            "-e",
            "TMPDIR=/tmp",

            "-v",
            f"{project_path}:/workspace:ro",
            "-w",
            "/workspace",

            self.image,

            *command,
        ]

        try:
            completed = subprocess.run(
                docker_command,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )

            return DockerRunResult(
                ok=completed.returncode == 0,
                exit_code=completed.returncode,
                stdout=completed.stdout,
                stderr=completed.stderr,
            )

        except subprocess.TimeoutExpired as exc:
            stdout = exc.stdout or ""
            stderr = exc.stderr or "Docker command timed out"

            if isinstance(stdout, bytes):
                stdout = stdout.decode("utf-8", errors="ignore")

            if isinstance(stderr, bytes):
                stderr = stderr.decode("utf-8", errors="ignore")

            return DockerRunResult(
                ok=False,
                exit_code=-1,
                stdout=stdout,
                stderr=stderr,
                timed_out=True,
            )