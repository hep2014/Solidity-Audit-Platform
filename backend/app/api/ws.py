import asyncio
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.database import SessionLocal
from app.models.analysis import Analysis
from app.core.enums import AnalysisStatus

router = APIRouter(prefix="/ws", tags=["websocket"])


TERMINAL_STATUSES = {
    AnalysisStatus.SUCCESS.value,
    AnalysisStatus.FAILED.value,
    AnalysisStatus.TIMEOUT.value,
    AnalysisStatus.PARTIAL_SUCCESS.value,
    AnalysisStatus.CANCELLED.value,
}

@router.websocket("/analyses/{analysis_id}")
async def analysis_status_ws(websocket: WebSocket, analysis_id: UUID):
    await websocket.accept()

    try:
        while True:
            db = SessionLocal()

            try:
                analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()

                if analysis is None:
                    await websocket.send_json({"error": "Analysis not found"})
                    break

                await websocket.send_json(
                    {
                        "analysis_id": str(analysis.id),
                        "status": analysis.status,
                        "progress": analysis.progress,
                        "current_step": analysis.current_step,
                    }
                )

                if analysis.status in {"SUCCESS", "FAILED", "TIMEOUT", "PARTIAL_SUCCESS"}:
                    break

            finally:
                db.close()

            await asyncio.sleep(1)

    except WebSocketDisconnect:
        return