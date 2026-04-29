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
        self.image = image or settings.analyzer_image
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
            )

            return DockerRunResult(
                ok=completed.returncode == 0,
                exit_code=completed.returncode,
                stdout=completed.stdout,
                stderr=completed.stderr,
            )

        except subprocess.TimeoutExpired as exc:
            return DockerRunResult(
                ok=False,
                exit_code=-1,
                stdout=exc.stdout or "",
                stderr=exc.stderr or "Docker command timed out",
                timed_out=True,
            )