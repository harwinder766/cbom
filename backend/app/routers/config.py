from fastapi import APIRouter
from pydantic import BaseModel
from backend.app.config import settings

router = APIRouter(prefix="/api/config", tags=["Configuration"])

class ConfigResponse(BaseModel):
    allowLocalScans: bool
    maxUploadSizeBytes: int
    maxRepoCloneSizeBytes: int
    scanTimeoutSeconds: int
    maxConcurrentScans: int

@router.get("", response_model=ConfigResponse)
def get_server_config():
    """Returns server runtime configuration flags and limits for the frontend client."""
    return ConfigResponse(
        allowLocalScans=settings.allow_local_scans,
        maxUploadSizeBytes=settings.max_upload_size_bytes,
        maxRepoCloneSizeBytes=settings.max_repo_clone_size_bytes,
        scanTimeoutSeconds=settings.scan_timeout_seconds,
        maxConcurrentScans=settings.max_concurrent_scans,
    )
