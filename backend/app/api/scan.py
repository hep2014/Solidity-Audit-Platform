import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.schemas.scan import ScanResponse
from app.services.solidity_scanner import scan_solidity

router = APIRouter(prefix="/scan", tags=["scan"])

UPLOAD_DIR = Path("storage/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/solidity", response_model=ScanResponse)
async def scan_solidity_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".sol"):
        raise HTTPException(status_code=400, detail="Only .sol files allowed")

    content = (await file.read()).decode("utf-8", errors="ignore")

    file_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{file_id}_{file.filename}"

    save_path.write_text(content, encoding="utf-8")

    issues = scan_solidity(content)

    return ScanResponse(
        filename=file.filename,
        issues=issues,
        total=len(issues)
    )