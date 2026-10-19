from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.scan import Scan
from backend.app.models.artefact import Artefact
from backend.app.schemas.artefact import ArtefactResponse, ArtefactUpdate, ArtefactListResponse
from backend.app.schemas.common import Location, Recommendation, RecommendationAlternative
from backend.app.services.knowledge_base import kb
from backend.app.services.risk_engine import calculate_mosca_risk

router = APIRouter(tags=["Artefacts"])

def serialize_artefact(art: Artefact) -> ArtefactResponse:
    rec_obj = None
    if art.replacement:
        alts = [
            RecommendationAlternative(
                nistStandard=a.get("nistStandard", ""),
                isHybrid=a.get("isHybrid", False),
                relativeLatency=a.get("relativeLatency", 1.0),
                keySizeBytes=a.get("keySizeBytes", 0),
                signatureSizeBytes=a.get("signatureSizeBytes", 0),
                relativeCost=a.get("relativeCost", "low"),
                rationale=a.get("rationale", "")
            )
            for a in (art.alternatives or [])
        ]
        rec_obj = Recommendation(
            replacement=art.replacement,
            latencyNote=art.latency_note or "",
            costNote=art.cost_note or "",
            alternatives=alts
        )

    return ArtefactResponse(
        id=art.id,
        name=art.name,
        type=art.type,
        location=Location(
            source=art.source_origin,
            path=art.path,
            line=art.line
        ),
        quantumVulnerable=art.quantum_vulnerable,
        algorithmClass=art.algorithm_class,
        confidence=art.confidence,
        riskLevel=art.risk_level,
        detectionMethod=art.detection_method,
        evidence=art.evidence,
        keySize=art.key_size,
        mode=art.mode,
        version=art.version,
        library=art.library,
        oid=art.oid,
        businessCriticality=art.business_criticality,
        dataLifetimeYears=art.shelf_life_years,
        shelfLifeYears=art.shelf_life_years,
        migrationTimeYears=art.migration_time_years,
        moscaVerdict=art.mosca_verdict,
        moscaMargin=art.mosca_margin,
        priorityScore=art.priority_score,
        recommendation=rec_obj
    )

@router.get("/api/scans/{scan_id}/artefacts", response_model=ArtefactListResponse)
def list_artefacts(
    scan_id: str,
    search: Optional[str] = None,
    riskLevel: str = "all",
    type: str = "all",
    quantumOnly: bool = False,
    sortBy: str = "riskLevel",
    sortAscending: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Filterable, searchable, sorted list of discovered cryptographic assets."""
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

    query = db.query(Artefact).filter(Artefact.scan_id == scan.id)

    # Search filter (name or path)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter((Artefact.name.ilike(term)) | (Artefact.path.ilike(term)))

    # Risk level filter
    if riskLevel != "all":
        query = query.filter(Artefact.risk_level == riskLevel.lower())

    # Asset type filter
    if type != "all":
        query = query.filter(Artefact.type == type.lower())

    # Quantum-vulnerable only
    if quantumOnly:
        query = query.filter(Artefact.quantum_vulnerable == True)

    total_filtered = query.count()

    # In-memory sorting for priority & risk level weights
    items = query.all()

    risk_weights = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    def sort_key(a: Artefact):
        if sortBy == "riskLevel":
            return (risk_weights.get(a.risk_level, 0), a.priority_score)
        elif sortBy == "confidence":
            return a.confidence
        elif sortBy == "name":
            return a.name.lower()
        elif sortBy == "type":
            return a.type.lower()
        elif sortBy == "algorithmClass":
            return a.algorithm_class.lower()
        elif sortBy == "location":
            return a.path.lower()
        return a.name.lower()

    sorted_items = sorted(items, key=sort_key, reverse=not sortAscending)
    paginated = sorted_items[offset : offset + limit]

    return ArtefactListResponse(
        total=total_filtered,
        limit=limit,
        offset=offset,
        artefacts=[serialize_artefact(a) for a in paginated]
    )

@router.get("/api/artefacts/{artefact_id}", response_model=ArtefactResponse)
def get_artefact(artefact_id: str, db: Session = Depends(get_db)):
    """Retrieves full details for a single cryptographic asset."""
    art = db.query(Artefact).filter(Artefact.id == artefact_id).first()
    if not art:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "ARTEFACT_NOT_FOUND", "message": f"Artefact with id '{artefact_id}' does not exist."}}
        )

    return serialize_artefact(art)

@router.patch("/api/artefacts/{artefact_id}", response_model=ArtefactResponse)
def update_artefact(artefact_id: str, payload: ArtefactUpdate, db: Session = Depends(get_db)):
    """Overrides business criticality or lifetime variables; persists per-artefact."""
    art = db.query(Artefact).filter(Artefact.id == artefact_id).first()
    if not art:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "ARTEFACT_NOT_FOUND", "message": f"Artefact with id '{artefact_id}' does not exist."}}
        )

    scan = db.query(Scan).filter(Scan.id == art.scan_id).first()
    z_years = scan.quantum_arrival_years if scan else 12
    exposure = scan.exposure_tag if scan else "internal"

    if payload.businessCriticality:
        art.business_criticality = payload.businessCriticality
    if payload.shelfLifeYears is not None:
        art.shelf_life_years = payload.shelfLifeYears
    if payload.migrationTimeYears is not None:
        art.migration_time_years = payload.migrationTimeYears

    # Re-evaluate Mosca metrics with updated variables
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
        quantum_arrival_years=z_years,
        exposure_tag=exposure
    )

    art.mosca_verdict = risk_eval["verdict"]
    art.mosca_margin = risk_eval["margin"]
    art.priority_score = risk_eval["priority_score"]
    art.risk_level = risk_eval["risk_level"]

    db.commit()
    db.refresh(art)

    return serialize_artefact(art)
