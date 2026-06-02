import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import settings
from app.schemas.scan import ScanResponse
from app.services.solidity_scanner import scan_solidity


router = APIRouter(prefix="/api/scan", tags=["scan"])

UPLOAD_DIR = settings.storage_path / "quick-scan"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/solidity", response_model=ScanResponse)
async def scan_solidity_file(file: UploadFile = File(...)):
    filename = Path(file.filename or "").name

    if not filename.endswith(".sol"):
        raise HTTPException(status_code=400, detail="Only .sol files allowed")

    content_bytes = await file.read()

    if not content_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(content_bytes) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Uploaded file is too large. Limit: {settings.max_upload_bytes} bytes",
        )

    content = content_bytes.decode("utf-8", errors="ignore")

    file_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{file_id}_{filename}"
    save_path.write_text(content, encoding="utf-8")

    issues = scan_solidity(content)

    return ScanResponse(
        filename=filename,
        issues=issues,
        total=len(issues),
    )