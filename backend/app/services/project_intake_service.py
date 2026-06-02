import re
import shutil
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException

from app.core.config import settings


SAFE_FILENAME_RE = re.compile(r"^[A-Za-z0-9._-]+\.(sol|zip)$")
PRAGMA_SOLC_RE = re.compile(r"pragma\s+solidity\s+([^;]+);")


@dataclass(frozen=True)
class ProjectIntakeResult:
    project_id: uuid.UUID
    name: str
    root_path: Path
    entrypoint_path: Path
    file_path: Path
    project_type: str
    solidity_files_count: int
    detected_solc_versions: list[str]
    metadata: dict


def _safe_upload_filename(raw_filename: str | None) -> str:
    filename = Path(raw_filename or "").name

    if not SAFE_FILENAME_RE.fullmatch(filename):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsafe filename. Only .sol and .zip files with letters, digits, "
                "dots, underscores and hyphens are allowed."
            ),
        )

    return filename


def _is_zip_symlink(member: zipfile.ZipInfo) -> bool:
    file_type = (member.external_attr >> 16) & 0o170000
    return file_type == 0o120000


def _validate_zip_member(member: zipfile.ZipInfo, extract_dir: Path) -> None:
    member_name = member.filename

    if not member_name or member_name.endswith("/"):
        return

    member_path = Path(member_name)

    if member_path.is_absolute() or ".." in member_path.parts:
        raise HTTPException(
            status_code=400,
            detail="Unsafe zip archive path detected",
        )

    if _is_zip_symlink(member):
        raise HTTPException(
            status_code=400,
            detail="Symlinks are not allowed in zip archives",
        )

    target_path = (extract_dir / member_name).resolve()

    try:
        target_path.relative_to(extract_dir.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Unsafe zip archive path detected",
        )


def _extract_zip_safely(zip_path: Path, extract_dir: Path) -> None:
    total_extracted_bytes = 0
    sol_files_count = 0

    try:
        with zipfile.ZipFile(zip_path, "r") as archive:
            members = archive.infolist()

            if len(members) > settings.max_archive_files:
                raise HTTPException(
                    status_code=400,
                    detail=f"Archive contains too many files. Limit: {settings.max_archive_files}",
                )

            for member in members:
                _validate_zip_member(member, extract_dir)

                total_extracted_bytes += member.file_size

                if total_extracted_bytes > settings.max_extracted_bytes:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Archive is too large after extraction. "
                            f"Limit: {settings.max_extracted_bytes} bytes"
                        ),
                    )

                if member.filename.endswith(".sol"):
                    sol_files_count += 1

                if sol_files_count > settings.max_sol_files:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Archive contains too many Solidity files. "
                            f"Limit: {settings.max_sol_files}"
                        ),
                    )

            archive.extractall(extract_dir)

    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip archive")


def _find_solidity_files(project_dir: Path) -> list[Path]:
    return sorted(project_dir.rglob("*.sol"))


def _detect_project_type(project_dir: Path, filename: str, sol_files: list[Path]) -> str:
    if filename.endswith(".sol"):
        return "single_file"

    if (project_dir / "foundry.toml").exists():
        return "foundry"

    if (project_dir / "hardhat.config.js").exists() or (project_dir / "hardhat.config.ts").exists():
        return "hardhat"

    if len(sol_files) > 1:
        return "multi_file"

    return "single_file"


def _find_project_entrypoint(project_dir: Path, sol_files: list[Path]) -> Path:
    foundry_toml = project_dir / "foundry.toml"

    if foundry_toml.exists():
        return foundry_toml.resolve()

    if not sol_files:
        raise HTTPException(
            status_code=400,
            detail="Project does not contain Solidity files",
        )

    src_files = [
        sol_file
        for sol_file in sol_files
        if "src" in sol_file.relative_to(project_dir).parts
    ]

    if src_files:
        return src_files[0].resolve()

    return sol_files[0].resolve()


def _detect_solc_versions(sol_files: list[Path]) -> list[str]:
    versions: set[str] = set()

    for sol_file in sol_files:
        content = sol_file.read_text(encoding="utf-8", errors="ignore")

        for match in PRAGMA_SOLC_RE.finditer(content):
            versions.add(match.group(1).strip())

    return sorted(versions)


def _build_metadata(project_dir: Path, entrypoint_path: Path, sol_files: list[Path]) -> dict:
    relative_sol_files = [
        sol_file.relative_to(project_dir).as_posix()
        for sol_file in sol_files
    ]

    return {
        "entrypoint_relative_path": entrypoint_path.relative_to(project_dir).as_posix(),
        "solidity_files": relative_sol_files,
        "has_foundry_toml": (project_dir / "foundry.toml").exists(),
        "has_hardhat_config": (
            (project_dir / "hardhat.config.js").exists()
            or (project_dir / "hardhat.config.ts").exists()
        ),
    }


def intake_uploaded_project(
    *,
    raw_filename: str | None,
    content: bytes,
) -> ProjectIntakeResult:
    filename = _safe_upload_filename(raw_filename)

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Uploaded file is too large. Limit: {settings.max_upload_bytes} bytes",
        )

    project_id = uuid.uuid4()
    storage_dir = settings.storage_path
    project_dir = (storage_dir / str(project_id)).resolve()
    project_dir.mkdir(parents=True, exist_ok=True)

    try:
        uploaded_path = project_dir / filename
        uploaded_path.write_bytes(content)

        if filename.endswith(".zip"):
            _extract_zip_safely(uploaded_path, project_dir)
            uploaded_path.unlink(missing_ok=True)

        else:
            if not content.strip():
                raise HTTPException(status_code=400, detail="Uploaded Solidity file is empty")

        sol_files = _find_solidity_files(project_dir)
        entrypoint_path = _find_project_entrypoint(project_dir, sol_files)

        try:
            entrypoint_path.relative_to(project_dir)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Resolved project entrypoint is outside project directory",
            )

        project_type = _detect_project_type(
            project_dir=project_dir,
            filename=filename,
            sol_files=sol_files,
        )
        detected_solc_versions = _detect_solc_versions(sol_files)
        metadata = _build_metadata(project_dir, entrypoint_path, sol_files)

        return ProjectIntakeResult(
            project_id=project_id,
            name=filename,
            root_path=project_dir,
            entrypoint_path=entrypoint_path,
            file_path=entrypoint_path,
            project_type=project_type,
            solidity_files_count=len(sol_files),
            detected_solc_versions=detected_solc_versions,
            metadata=metadata,
        )

    except Exception:
        shutil.rmtree(project_dir, ignore_errors=True)
        raise