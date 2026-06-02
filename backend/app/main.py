from fastapi import FastAPI

from app.api.analyses import router as analyses_router
from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.scan import router as scan_router
from app.api.ws import router as ws_router
from app.core.logging import setup_logging
from app.middleware.request_logging import RequestLoggingMiddleware


setup_logging()

app = FastAPI(title="Solidity Audit Platform")

app.add_middleware(RequestLoggingMiddleware)

app.include_router(health_router)
app.include_router(projects_router)
app.include_router(analyses_router)
app.include_router(scan_router)
app.include_router(ws_router)