import os
import shutil
import zipfile
import uuid
import datetime
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.scan import Scan
from backend.app.schemas.scan import ScanCreate, ScanResponse, ScanStatusResponse, ScanListResponse
from backend.app.schemas.common import ErrorResponse, ErrorDetail
from backend.app.services.scan_orchestrator import run_scan_pipeline

router = APIRouter(prefix="/api/scans", tags=["Scans"])

@router.post("", response_model=ScanResponse, status_code=201)
def create_scan(
    payload: Optional[ScanCreate] = None,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """Initiates a new cryptographic discovery scan via JSON payload."""
    if not payload:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "VALIDATION_ERROR", "message": "Missing scan payload."}}
        )

    # Enforce maximum concurrent active scans
    active_scans = db.query(Scan).filter(Scan.status.in_(["running", "queued"])).count()
    if active_scans >= settings.max_concurrent_scans:
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "CONCURRENCY_LIMIT_EXCEEDED", "message": f"Server is busy: maximum concurrent scans limit ({settings.max_concurrent_scans}) reached. Please wait for running scans to finish."}}
        )

    scan_id = f"scan_{uuid.uuid4().hex[:8]}"

    # Local path security validation
    if payload.sourceType == "local":
        if not settings.allow_local_scans:
            raise HTTPException(
                status_code=403,
                detail={"error": {"code": "LOCAL_PATH_FORBIDDEN", "message": "Local path scans are disabled on this server instance for security."}}
            )
        local_path = Path(payload.target).resolve()
        if not settings.dev_mode:
            allowed = any(str(local_path).startswith(str(r)) for r in settings.allowlisted_roots_list)
            if not allowed:
                raise HTTPException(
                    status_code=403,
                    detail={"error": {"code": "LOCAL_PATH_FORBIDDEN", "message": f"Local path '{payload.target}' is outside allowlisted scan roots."}}
                )
        if not local_path.exists():
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "LOCAL_PATH_NOT_FOUND", "message": f"Local path '{payload.target}' does not exist."}}
            )

    new_scan = Scan(
        id=scan_id,
        source_type=payload.sourceType,
        target=payload.target,
        exposure_tag=payload.exposureTag,
        status="queued",
        progress=0,
        current_stage="Initializing workspace sandbox...",
        artefacts_found=0,
        created_at=datetime.datetime.now(datetime.timezone.utc),
        quantum_arrival_years=settings.default_crqc_years,
        default_shelf_life_years=settings.default_shelf_life_years,
        default_migration_time_years=settings.default_migration_time_years
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

    # Launch background scanning task
    background_tasks.add_task(run_scan_pipeline, scan_id)

    return ScanResponse(
        id=new_scan.id,
        status=new_scan.status,
        sourceType=new_scan.source_type,
        target=new_scan.target,
        exposureTag=new_scan.exposure_tag,
        progress=new_scan.progress,
        currentStage=new_scan.current_stage,
        artefactsFound=new_scan.artefacts_found,
        createdAt=new_scan.created_at.isoformat() + "Z",
        completedAt=new_scan.completed_at.isoformat() + "Z" if new_scan.completed_at else None
    )

@router.post("/upload", response_model=ScanResponse, status_code=201)
async def upload_and_scan(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    exposureTag: str = Form("internal"),
    db: Session = Depends(get_db)
):
    """Initiates a scan by uploading source files, zips, or container images."""
    if not files:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "NO_FILES_UPLOADED", "message": "At least one file is required."}}
        )

    # Enforce maximum concurrent active scans
    active_scans = db.query(Scan).filter(Scan.status.in_(["running", "queued"])).count()
    if active_scans >= settings.max_concurrent_scans:
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "CONCURRENCY_LIMIT_EXCEEDED", "message": f"Server is busy: maximum concurrent scans limit ({settings.max_concurrent_scans}) reached. Please wait for running scans to finish."}}
        )

    scan_id = f"scan_{uuid.uuid4().hex[:8]}"
    upload_target_dir = (Path(settings.upload_dir) / scan_id).resolve()
    upload_target_dir.mkdir(parents=True, exist_ok=True)

    saved_paths = []
    total_bytes = 0

    for f in files:
        raw_name = (f.filename or "").replace("\\", "/").strip()
        if not raw_name:
            shutil.rmtree(upload_target_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "INVALID_FILENAME", "message": "Uploaded file must have a non-empty name."}}
            )

        # Strict path-traversal validation: reject absolute paths, drive letters, and parent traversal
        p_parts = Path(raw_name).parts
        if raw_name.startswith("/") or ":" in raw_name or ".." in p_parts:
            shutil.rmtree(upload_target_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "PATH_TRAVERSAL_DETECTED", "message": f"Illegal path traversal detected in file: '{f.filename}'"}}
            )

        save_path = (upload_target_dir / raw_name).resolve()
        if not save_path.is_relative_to(upload_target_dir):
            shutil.rmtree(upload_target_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "PATH_TRAVERSAL_DETECTED", "message": f"Illegal path traversal detected in file: '{f.filename}'"}}
            )

        # Rebuild parent directory tree
        save_path.parent.mkdir(parents=True, exist_ok=True)

        content = await f.read()
        total_bytes += len(content)
        if total_bytes > settings.max_upload_size_bytes:
            shutil.rmtree(upload_target_dir, ignore_errors=True)
            raise HTTPException(
                status_code=413,
                detail={"error": {"code": "PAYLOAD_TOO_LARGE", "message": f"Total upload size exceeds maximum allowed limit of {settings.max_upload_size_bytes // (1024 * 1024)}MB."}}
            )

        with open(save_path, "wb") as out_file:
            out_file.write(content)
        saved_paths.append(str(save_path))

        # If file is a zip archive, safely validate against zip-slip and bomb limits
        if save_path.suffix.lower() == ".zip":
            try:
                with zipfile.ZipFile(save_path, "r") as zf:
                    zip_uncompressed = 0
                    for z_idx, info in enumerate(zf.infolist()):
                        if z_idx >= settings.max_zip_file_count:
                            shutil.rmtree(upload_target_dir, ignore_errors=True)
                            raise HTTPException(
                                status_code=400,
                                detail={"error": {"code": "ZIP_TOO_MANY_FILES", "message": f"Zip archive exceeds maximum allowed file count ({settings.max_zip_file_count})."}}
                            )
                        zip_uncompressed += info.file_size
                        if zip_uncompressed > settings.max_zip_extracted_size_bytes:
                            shutil.rmtree(upload_target_dir, ignore_errors=True)
                            raise HTTPException(
                                status_code=400,
                                detail={"error": {"code": "ZIP_TOO_LARGE", "message": f"Zip uncompressed size exceeds limit of {settings.max_zip_extracted_size_bytes // (1024 * 1024)}MB."}}
                            )
                        z_norm = info.filename.replace("\\", "/").strip()
                        if z_norm.startswith("/") or ":" in z_norm or ".." in Path(z_norm).parts:
                            shutil.rmtree(upload_target_dir, ignore_errors=True)
                            raise HTTPException(
                                status_code=400,
                                detail={"error": {"code": "ZIP_SLIP_DETECTED", "message": f"Zip-slip path traversal attempt detected in zip member: '{info.filename}'"}}
                            )
                        check_dest = (upload_target_dir / z_norm).resolve()
                        if not check_dest.is_relative_to(upload_target_dir):
                            shutil.rmtree(upload_target_dir, ignore_errors=True)
                            raise HTTPException(
                                status_code=400,
                                detail={"error": {"code": "ZIP_SLIP_DETECTED", "message": f"Zip-slip path traversal attempt detected in zip member: '{info.filename}'"}}
                            )
            except zipfile.BadZipFile:
                shutil.rmtree(upload_target_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=400,
                    detail={"error": {"code": "INVALID_ZIP", "message": f"Uploaded file '{f.filename}' is not a valid zip archive."}}
                )

    # If single zip or tar uploaded
    primary_target = str(saved_paths[0]) if len(saved_paths) == 1 else str(upload_target_dir)
    source_type = "image" if primary_target.endswith(".tar") else "upload"

    new_scan = Scan(
        id=scan_id,
        source_type=source_type,
        target=primary_target,
        exposure_tag=exposureTag,
        status="queued",
        progress=0,
        current_stage="Uploaded files received. Queuing scan...",
        artefacts_found=0,
        created_at=datetime.datetime.now(datetime.timezone.utc),
        quantum_arrival_years=settings.default_crqc_years,
        default_shelf_life_years=settings.default_shelf_life_years,
        default_migration_time_years=settings.default_migration_time_years
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

    background_tasks.add_task(run_scan_pipeline, scan_id)

    return ScanResponse(
        id=new_scan.id,
        status=new_scan.status,
        sourceType=new_scan.source_type,
        target=Path(new_scan.target).name,
        exposureTag=new_scan.exposure_tag,
        progress=new_scan.progress,
        currentStage=new_scan.current_stage,
        artefactsFound=new_scan.artefacts_found,
        createdAt=new_scan.created_at.isoformat() + "Z",
        completedAt=None
    )

@router.get("", response_model=ScanListResponse)
def list_scans(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    """Lists historical scans with pagination."""
    total = db.query(Scan).count()
    scans = db.query(Scan).order_by(Scan.created_at.desc()).offset(offset).limit(limit).all()

    items = [
        ScanResponse(
            id=s.id,
            status=s.status,
            sourceType=s.source_type,
            target=s.target,
            exposureTag=s.exposure_tag,
            progress=s.progress,
            currentStage=s.current_stage,
            artefactsFound=s.artefacts_found,
            createdAt=s.created_at.isoformat() + "Z",
            completedAt=s.completed_at.isoformat() + "Z" if s.completed_at else None
        )
        for s in scans
    ]

    return ScanListResponse(
        total=total,
        limit=limit,
        offset=offset,
        scans=items
    )

@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(scan_id: str, db: Session = Depends(get_db)):
    """Retrieves full scan metadata."""
    if scan_id == "latest":
        scan = db.query(Scan).order_by(Scan.created_at.desc()).first()
        if not scan:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NO_SCANS_EXIST", "message": "No scans have been performed yet."}}
            )
    else:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan with id '{scan_id}' does not exist."}}
            )

    return ScanResponse(
        id=scan.id,
        status=scan.status,
        sourceType=scan.source_type,
        target=scan.target,
        exposureTag=scan.exposure_tag,
        progress=scan.progress,
        currentStage=scan.current_stage,
        artefactsFound=scan.artefacts_found,
        createdAt=scan.created_at.isoformat() + "Z",
        completedAt=scan.completed_at.isoformat() + "Z" if scan.completed_at else None
    )

@router.get("/{scan_id}/status", response_model=ScanStatusResponse)
def get_scan_status(scan_id: str, db: Session = Depends(get_db)):
    """Polls live scan progress, current stage, and artefacts found."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan with id '{scan_id}' does not exist."}}
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    end_time = (scan.completed_at.replace(tzinfo=datetime.timezone.utc) if scan.completed_at and scan.completed_at.tzinfo is None else scan.completed_at) or now
    created_at = scan.created_at.replace(tzinfo=datetime.timezone.utc) if scan.created_at and scan.created_at.tzinfo is None else scan.created_at
    elapsed = max(0.0, (end_time - created_at).total_seconds())

    return ScanStatusResponse(
        id=scan.id,
        status=scan.status,
        progress=scan.progress,
        currentStage=scan.current_stage,
        artefactsFound=scan.artefacts_found,
        error=scan.error,
        elapsedSeconds=round(elapsed, 2)
    )
