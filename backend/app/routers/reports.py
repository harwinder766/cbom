import json
import datetime
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.scan import Scan
from backend.app.models.artefact import Artefact
from backend.app.schemas.recommendations import ReportsSummaryResponse, ReportArtefactItem
from backend.app.services.cbom_generator import (
    generate_cyclonedx_cbom,
    generate_csv_report,
    generate_html_report,
    generate_pdf_report
)

router = APIRouter(prefix="/api/scans", tags=["Reports"])

@router.get("/{scan_id}/reports-summary", response_model=ReportsSummaryResponse)
def get_reports_summary(scan_id: str, db: Session = Depends(get_db)):
    """Provides grouped Quantum vs Classical legacy findings matching Reports UI."""
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

    artefacts = db.query(Artefact).filter(Artefact.scan_id == scan.id).all()

    quantum_items = []
    legacy_items = []

    for a in artefacts:
        rec_data = None
        if a.replacement:
            rec_data = {
                "replacement": a.replacement,
                "latencyNote": a.latency_note or "",
                "costNote": a.cost_note or "",
                "alternatives": a.alternatives or []
            }

        item = ReportArtefactItem(
            artefactId=a.id,
            name=a.name,
            type=a.type,
            location={"source": a.source_origin, "path": a.path, "line": a.line},
            quantumVulnerable=a.quantum_vulnerable,
            algorithmClass=a.algorithm_class,
            detectionMethod=a.detection_method,
            confidence=a.confidence,
            businessCriticality=a.business_criticality,
            dataLifetimeYears=a.shelf_life_years,
            riskLevel=a.risk_level,
            recommendation=rec_data
        )

        if a.quantum_vulnerable:
            quantum_items.append(item)
        else:
            legacy_items.append(item)

    return ReportsSummaryResponse(
        scanId=scan.id,
        quantumRiskItems=quantum_items,
        legacyRiskItems=legacy_items
    )

@router.get("/{scan_id}/report")
def export_report(
    scan_id: str,
    format: str = Query("cbom", pattern="^(cbom|csv|pdf|html)$"),
    db: Session = Depends(get_db)
):
    """Exports cryptographic assessment reports in standardized CycloneDX 1.6 CBOM, CSV, PDF, or print-optimised HTML format."""
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

    artefacts = db.query(Artefact).filter(Artefact.scan_id == scan.id).all()
    timestamp_slug = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")

    if format == "cbom":
        cbom_data = generate_cyclonedx_cbom(scan, artefacts)
        json_bytes = json.dumps(cbom_data, indent=2).encode("utf-8")
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="cbom-report-{timestamp_slug}.json"'}
        )

    elif format == "csv":
        csv_text = generate_csv_report(artefacts)
        return Response(
            content=csv_text.encode("utf-8"),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="cbom-report-{timestamp_slug}.csv"'}
        )

    elif format == "pdf":
        pdf_bytes = generate_pdf_report(scan, artefacts)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="cbom-executive-report-{timestamp_slug}.pdf"'}
        )

    elif format == "html":
        html_content = generate_html_report(scan, artefacts)
        return Response(
            content=html_content.encode("utf-8"),
            media_type="text/html"
        )
