import datetime
from fastapi import APIRouter
from backend.app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])

@router.get("/api/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="ok",
        version="1.0.0",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
