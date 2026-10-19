from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.scan import Scan
from backend.app.models.artefact import Artefact
from backend.app.schemas.risk import (
    RiskSummaryResponse, GlobalMoscaParams, RiskSummaryStats, TopRiskFinding, RecalculateRiskRequest
)
from backend.app.services.knowledge_base import kb
from backend.app.services.risk_engine import calculate_mosca_risk

router = APIRouter(prefix="/api/scans", tags=["Risk Engine"])

def build_risk_summary(scan: Scan, db: Session) -> RiskSummaryResponse:
    artefacts = db.query(Artefact).filter(Artefact.scan_id == scan.id).all()
    total = len(artefacts)

    violated_count = sum(1 for a in artefacts if a.mosca_verdict == "violated")
    within_window = sum(1 for a in artefacts if a.mosca_verdict == "within_window")
    broken_today = sum(1 for a in artefacts if a.mosca_verdict == "broken_today")
    quantum_safe = sum(1 for a in artefacts if a.mosca_verdict == "quantum_safe")

    avg_priority = round(sum(a.priority_score for a in artefacts) / total, 1) if total > 0 else 0.0

    sorted_risks = sorted(artefacts, key=lambda a: a.priority_score, reverse=True)[:10]

    top_risks = [
        TopRiskFinding(
            artefactId=a.id,
            name=a.name,
            location=f"{a.path}:{a.line}" if a.line else a.path,
            shelfLifeYears=a.shelf_life_years,
            migrationTimeYears=a.migration_time_years,
            quantumArrivalYears=scan.quantum_arrival_years,
            deficitYears=a.mosca_margin,
            verdict=a.mosca_verdict,
            priorityScore=a.priority_score
        )
        for a in sorted_risks
    ]

    return RiskSummaryResponse(
        scanId=scan.id,
        globalParams=GlobalMoscaParams(
            quantumArrivalYears=scan.quantum_arrival_years,
            defaultShelfLifeYears=scan.default_shelf_life_years,
            defaultMigrationTimeYears=scan.default_migration_time_years
        ),
        summary=RiskSummaryStats(
            totalEvaluated=total,
            violatedCount=violated_count,
            withinWindowCount=within_window,
            classicallyBrokenCount=broken_today,
            quantumSafeCount=quantum_safe,
            averagePriorityScore=avg_priority
        ),
        topRisks=top_risks
    )

@router.get("/{scan_id}/risk", response_model=RiskSummaryResponse)
def get_risk_summary(scan_id: str, db: Session = Depends(get_db)):
    """Retrieves Mosca inequality evaluation and risk breakdown."""
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

    return build_risk_summary(scan, db)

@router.post("/{scan_id}/risk/recalculate", response_model=RiskSummaryResponse)
def recalculate_risk(scan_id: str, payload: RecalculateRiskRequest, db: Session = Depends(get_db)):
    """Recalculates Mosca risk with updated global parameters; persists per-scan."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan with id '{scan_id}' does not exist."}}
        )

    if payload.quantumArrivalYears is not None:
        scan.quantum_arrival_years = payload.quantumArrivalYears
    if payload.shelfLifeYears is not None:
        scan.default_shelf_life_years = payload.shelfLifeYears
    if payload.migrationTimeYears is not None:
        scan.default_migration_time_years = payload.migrationTimeYears

    # Re-evaluate all artefacts for this scan
    artefacts = db.query(Artefact).filter(Artefact.scan_id == scan.id).all()
    for art in artefacts:
        # Update default shelf life if not customized
        if payload.shelfLifeYears is not None:
            art.shelf_life_years = payload.shelfLifeYears
        if payload.migrationTimeYears is not None:
            art.migration_time_years = payload.migrationTimeYears

        kb_entry = kb.lookup_algorithm(art.name)
        quantum_status = kb_entry.get("quantumStatus", "quantum_safe") if kb_entry else "quantum_safe"

        risk_eval = calculate_mosca_risk(
            name=art.name,
            path=art.path,
            algo_type=art.type,
            quantum_status=quantum_status,
            business_criticality=art.business_criticality,
            shelf_life_years=art.shelf_life_years,
            migration_time_years=art.migration_time_years,
            quantum_arrival_years=scan.quantum_arrival_years,
            exposure_tag=scan.exposure_tag
        )

        art.mosca_verdict = risk_eval["verdict"]
        art.mosca_margin = risk_eval["margin"]
        art.priority_score = risk_eval["priority_score"]
        art.risk_level = risk_eval["risk_level"]

    db.commit()
    db.refresh(scan)

    return build_risk_summary(scan, db)
