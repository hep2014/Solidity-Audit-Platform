import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.project import Project
from app.schemas.project import ProjectRead
from app.services.project_intake_service import intake_uploaded_project


router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("/upload", response_model=ProjectRead)
async def upload_project(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()

    intake = intake_uploaded_project(
        raw_filename=file.filename,
        content=content,
    )

    project = Project(
        id=intake.project_id,
        name=intake.name,
        file_path=str(intake.file_path),
        root_path=str(intake.root_path),
        entrypoint_path=str(intake.entrypoint_path),
        project_type=intake.project_type,
        solidity_files_count=intake.solidity_files_count,
        detected_solc_versions=intake.detected_solc_versions,
        project_metadata=intake.metadata,
    )

    try:
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    except Exception:
        db.rollback()
        shutil.rmtree(intake.root_path, ignore_errors=True)
        raise


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.root_path:
        project_dir = Path(project.root_path).resolve()
    else:
        project_dir = Path(project.file_path).resolve().parent

    db.delete(project)
    db.commit()

    try:
        storage_root = settings.storage_path.resolve()
        project_dir.relative_to(storage_root)
        shutil.rmtree(project_dir, ignore_errors=True)
    except ValueError:
        pass

    return {
        "status": "deleted",
        "project_id": str(project_id),
    }