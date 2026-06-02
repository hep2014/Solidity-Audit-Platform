from fastapi import FastAPI

from app.api.analyses import router as analyses_router
from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.scan import router as scan_router
from app.api.ws import router as ws_router


app = FastAPI(title="Solidity Audit Platform")


app.include_router(health_router)
app.include_router(projects_router)
app.include_router(analyses_router)
app.include_router(scan_router)
app.include_router(ws_router)