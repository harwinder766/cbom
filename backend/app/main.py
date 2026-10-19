from contextlib import asynccontextmanager
import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.config import settings
from backend.app.database import init_db, SessionLocal
from backend.app.models.scan import Scan

def fail_interrupted_scans() -> int:
    """
    Marks any scans left in 'running' or 'queued' state as 'failed'
    with error 'interrupted by server restart'.
    """
    db = SessionLocal()
    try:
        scans = db.query(Scan).filter(Scan.status.in_(["running", "queued"])).all()
        now = datetime.datetime.now(datetime.timezone.utc)
        count = len(scans)
        for s in scans:
            s.status = "failed"
            s.error = "interrupted by server restart"
            s.current_stage = "Failed: interrupted by server restart"
            s.completed_at = now
        if count > 0:
            db.commit()
        return count
    finally:
        db.close()

# Initialize database schema immediately
init_db()
fail_interrupted_scans()

# Routers
from backend.app.routers import (
    health,
    config,
    scans,
    dashboard,
    artefacts,
    risk,
    risk_graph,
    recommendations,
    reports
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    fail_interrupted_scans()
    yield

app = FastAPI(
    title="Enterprise Cryptographic Discovery & Analysis Tool (ECDAT)",
    description="Backend API for cryptographic discovery, Mosca post-quantum risk analysis, and CycloneDX 1.6 CBOM generation.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standardized Error Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": str(exc.detail),
                "details": None
            }
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request payload validation failed.",
                "details": exc.errors()
            }
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred during execution.",
                "details": str(exc)
            }
        }
    )

# Mount Routers
app.include_router(health.router)
app.include_router(config.router)
app.include_router(scans.router)
app.include_router(dashboard.router)
app.include_router(artefacts.router)
app.include_router(risk.router)
app.include_router(risk_graph.router)
app.include_router(recommendations.router)
app.include_router(reports.router)
