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
        memory_limit: str = "1g",
    ):
        self.image = image
        self.timeout_seconds = timeout_seconds or settings.analyzer_timeout_seconds
        self.memory_limit = memory_limit

    def _resolve_mount_path_for_docker(self, project_path: Path) -> Path:
        """
        project_path is a path inside backend-worker container, for example:
            /app/storage/uploads/<project_id>

        Docker daemon is the host daemon through /var/run/docker.sock.
        Therefore docker run -v must receive a host path, for example:
            /home/hep2014/.../backend/storage/uploads/<project_id>

        Important:
        The resolved host path must NOT be checked with Path.exists()
        inside backend-worker, because it is a host path, not a container path.
        """
        if not settings.docker_host_storage_dir:
            return project_path

        container_storage_dir = Path(settings.docker_container_storage_dir).resolve()
        host_storage_dir = Path(settings.docker_host_storage_dir).resolve()
        project_path = project_path.resolve()

        try:
            relative_path = project_path.relative_to(container_storage_dir)
        except ValueError:
            return project_path

        direct_host_path = host_storage_dir / relative_path

        # Normal case:
        # /app/storage/uploads/<uuid>
        # -> <host_storage>/uploads/<uuid>
        if len(relative_path.parts) >= 2 and relative_path.parts[0] == "uploads":
            return direct_host_path

        # Compatibility case:
        # /app/storage/<uuid>
        # -> <host_storage>/uploads/<uuid>
        if len(relative_path.parts) == 1:
            return host_storage_dir / "uploads" / relative_path.parts[0]

        return direct_host_path

    def run(
        self,
        project_path: str | Path,
        command: list[str],
    ) -> DockerRunResult:
        project_path = Path(project_path).resolve()

        # This path is inside backend-worker and can be checked here.
        if not project_path.exists():
            return DockerRunResult(
                ok=False,
                exit_code=-1,
                stdout="",
                stderr=(
                    "Project path does not exist inside backend container.\n"
                    f"Container project path: {project_path}\n"
                ),
            )

        docker_mount_path = self._resolve_mount_path_for_docker(project_path)

        if not self.image:
            return DockerRunResult(
                ok=False,
                exit_code=-1,
                stdout="",
                stderr="Docker image is not configured.",
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
            self.memory_limit,
            "--pids-limit",
            "256",
            "-v",
            f"{docker_mount_path}:/workspace:ro",
            "-w",
            "/workspace",
            self.image,
            *command,
        ]

        diagnostic = (
            "DockerRunner diagnostic:\n"
            f"Container project path: {project_path}\n"
            f"Container storage dir: {settings.docker_container_storage_dir}\n"
            f"Host storage dir: {settings.docker_host_storage_dir}\n"
            f"Resolved host mount path: {docker_mount_path}\n"
            f"Image: {self.image}\n"
            f"Command: {' '.join(docker_command)}\n"
        )

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
                stderr=diagnostic + "\n" + completed.stderr,
            )

        except subprocess.TimeoutExpired as exc:
            return DockerRunResult(
                ok=False,
                exit_code=-1,
                stdout=exc.stdout or "",
                stderr=diagnostic + "\n" + (exc.stderr or "Docker command timed out"),
                timed_out=True,
            )