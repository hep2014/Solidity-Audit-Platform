from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    redis_url: str

    storage_dir: str = "storage/uploads"

    slither_image: str
    mythril_image: str
    foundry_image: str
    echidna_image: str

    analyzer_timeout_seconds: int = 120

    celery_task_soft_time_limit_seconds: int = 900
    celery_task_time_limit_seconds: int = 960

    max_upload_bytes: int = 25 * 1024 * 1024
    max_extracted_bytes: int = 100 * 1024 * 1024
    max_archive_files: int = 500
    max_sol_files: int = 200

    docker_container_storage_dir: str = "/app/storage"
    docker_host_storage_dir: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def storage_path(self) -> Path:
        return Path(self.storage_dir)


settings = Settings()