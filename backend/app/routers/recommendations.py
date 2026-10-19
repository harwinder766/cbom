from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.scan import Scan
from backend.app.models.artefact import Artefact
from backend.app.schemas.recommendations import RecommendationItem, RecommendationsResponse
from backend.app.schemas.common import RecommendationAlternative

router = APIRouter(prefix="/api/scans", tags=["Recommendations"])

@router.get("/{scan_id}/recommendations", response_model=RecommendationsResponse)
def get_recommendations(scan_id: str, db: Session = Depends(get_db)):
    """Retrieves NIST PQC migration alternatives and trade-offs for discovered assets."""
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
    rec_items = []

    for a in artefacts:
        if not a.replacement:
            continue

        alts = [
            RecommendationAlternative(
                nistStandard=alt.get("nistStandard", ""),
                isHybrid=alt.get("isHybrid", False),
                relativeLatency=alt.get("relativeLatency", 1.0),
                keySizeBytes=alt.get("keySizeBytes", 0),
                signatureSizeBytes=alt.get("signatureSizeBytes", 0),
                relativeCost=alt.get("relativeCost", "low"),
                rationale=alt.get("rationale", "")
            )
            for alt in (a.alternatives or [])
        ]

        rec_items.append(RecommendationItem(
            artefactId=a.id,
            currentAlgorithm=a.name,
            currentClass=a.algorithm_class,
            quantumVulnerable=a.quantum_vulnerable,
            riskLevel=a.risk_level,
            primaryReplacement=a.replacement,
            latencyNote=a.latency_note or "",
            costNote=a.cost_note or "",
            alternatives=alts
        ))

    return RecommendationsResponse(
        scanId=scan.id,
        recommendations=rec_items
    )
