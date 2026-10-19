from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.scan import Scan
from backend.app.models.artefact import Artefact
from backend.app.schemas.risk_graph import RiskGraphResponse
from backend.app.services.risk_graph_builder import build_risk_graph

router = APIRouter(prefix="/api/scans", tags=["Risk Graph"])

@router.get("/{scan_id}/risk-graph", response_model=RiskGraphResponse)
def get_risk_graph(scan_id: str, db: Session = Depends(get_db)):
    """Generates dynamic 3-column risk topology derived from actual scan assets."""
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
    graph_data = build_risk_graph(artefacts)

    return RiskGraphResponse(
        nodes=graph_data["nodes"],
        edges=graph_data["edges"]
    )
