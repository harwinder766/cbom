from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.scan import Scan
from backend.app.models.artefact import Artefact
from backend.app.schemas.dashboard import DashboardResponse, RecentFinding

router = APIRouter(prefix="/api/scans", tags=["Dashboard"])

RISK_SORT_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1}

@router.get("/{scan_id}/dashboard", response_model=DashboardResponse)
def get_dashboard(scan_id: str, db: Session = Depends(get_db)):
    """Provides aggregate cryptographic inventory metrics and top findings."""
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
    total = len(artefacts)

    critical_count = sum(1 for a in artefacts if a.risk_level == "critical")
    high_count = sum(1 for a in artefacts if a.risk_level == "high")
    medium_count = sum(1 for a in artefacts if a.risk_level == "medium")
    low_count = sum(1 for a in artefacts if a.risk_level == "low")

    critical_pct = round((critical_count / total * 100)) if total > 0 else 0
    high_pct = round((high_count / total * 100)) if total > 0 else 0
    medium_pct = round((medium_count / total * 100)) if total > 0 else 0
    low_pct = round((low_count / total * 100)) if total > 0 else 0

    quantum_vuln = sum(1 for a in artefacts if a.quantum_vulnerable)
    quantum_vuln_pct = round((quantum_vuln / total * 100)) if total > 0 else 0

    symm_count = sum(1 for a in artefacts if a.algorithm_class == "symmetric")
    symm_pct = round((symm_count / total * 100)) if total > 0 else 0

    hash_count = sum(1 for a in artefacts if a.algorithm_class == "hash")
    hash_pct = round((hash_count / total * 100)) if total > 0 else 0

    # Sort by risk weight descending to get top 5 findings
    sorted_recent = sorted(
        artefacts,
        key=lambda a: (RISK_SORT_ORDER.get(a.risk_level, 0), a.priority_score),
        reverse=True
    )[:5]

    recent_findings = [
        RecentFinding(
            id=a.id,
            name=a.name,
            type=a.type,
            riskLevel=a.risk_level,
            algorithmClass=a.algorithm_class,
            location=f"{a.path}:{a.line}" if a.line else a.path
        )
        for a in sorted_recent
    ]

    return DashboardResponse(
        scanId=scan.id,
        totalArtefacts=total,
        sourceFilesCount=scan.source_files_count or 1,
        systemExposure=scan.exposure_tag.upper(),
        createdAt=scan.created_at.isoformat() + "Z",
        completedAt=scan.completed_at.isoformat() + "Z" if scan.completed_at else None,
        criticalCount=critical_count,
        highCount=high_count,
        mediumCount=medium_count,
        lowCount=low_count,
        criticalPct=critical_pct,
        highPct=high_pct,
        mediumPct=medium_pct,
        lowPct=low_pct,
        quantumVulnerableCount=quantum_vuln,
        quantumVulnerablePct=quantum_vuln_pct,
        symmetricCount=symm_count,
        symmetricPct=symm_pct,
        hashCount=hash_count,
        hashPct=hash_pct,
        recentFindings=recent_findings
    )
