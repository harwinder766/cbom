from typing import Optional, List
from pydantic import BaseModel

class RecentFinding(BaseModel):
    id: str
    name: str
    type: str
    riskLevel: str
    algorithmClass: str
    location: str

class DashboardResponse(BaseModel):
    scanId: str
    totalArtefacts: int
    sourceFilesCount: int
    systemExposure: str
    createdAt: str
    completedAt: Optional[str] = None
    criticalCount: int
    highCount: int
    mediumCount: int
    lowCount: int
    criticalPct: int
    highPct: int
    mediumPct: int
    lowPct: int
    quantumVulnerableCount: int
    quantumVulnerablePct: int
    symmetricCount: int
    symmetricPct: int
    hashCount: int
    hashPct: int
    recentFindings: List[RecentFinding]
