import shutil
import uuid
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.project import Project
from app.schemas.project import ProjectRead


router = APIRouter(prefix="/api/projects", tags=["projects"])

STORAGE_DIR = Path("storage/uploads")
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _is_safe_zip_path(base_dir: Path, target_path: Path) -> bool:
    try:
        target_path.resolve().relative_to(base_dir.resolve())
        return True
    except ValueError:
        return False


def _extract_zip_safely(zip_path: Path, extract_dir: Path) -> None:
    with zipfile.ZipFile(zip_path, "r") as archive:
        for member in archive.infolist():
            member_path = extract_dir / member.filename

            if not _is_safe_zip_path(extract_dir, member_path):
                raise HTTPException(
                    status_code=400,
                    detail="Unsafe zip archive path detected",
                )

        archive.extractall(extract_dir)


def _find_project_entrypoint(project_dir: Path) -> Path:
    foundry_toml = project_dir / "foundry.toml"

    if foundry_toml.exists():
        return foundry_toml

    sol_files = list(project_dir.rglob("*.sol"))

    if not sol_files:
        raise HTTPException(
            status_code=400,
            detail="Archive does not contain Solidity files",
        )

    return sol_files[0]


@router.post("/upload", response_model=ProjectRead)
async def upload_project(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    filename = file.filename or ""

    if not filename.endswith((".sol", ".zip")):
        raise HTTPException(
            status_code=400,
            detail="Only .sol and .zip files are allowed",
        )

    content = await file.read()

    if not content.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    project_id = uuid.uuid4()
    project_dir = STORAGE_DIR / str(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)

    uploaded_path = project_dir / filename
    uploaded_path.write_bytes(content)

    if filename.endswith(".sol"):
        file_path = uploaded_path

    else:
        try:
            _extract_zip_safely(uploaded_path, project_dir)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid zip archive")

        uploaded_path.unlink(missing_ok=True)
        file_path = _find_project_entrypoint(project_dir)

    project = Project(
        id=project_id,
        name=filename,
        file_path=str(file_path),
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()