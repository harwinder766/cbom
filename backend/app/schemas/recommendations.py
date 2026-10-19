from typing import List, Optional
from pydantic import BaseModel
from backend.app.schemas.common import RecommendationAlternative

class RecommendationItem(BaseModel):
    artefactId: str
    currentAlgorithm: str
    currentClass: str
    quantumVulnerable: bool
    riskLevel: str
    primaryReplacement: str
    latencyNote: str
    costNote: str
    alternatives: List[RecommendationAlternative] = []

class RecommendationsResponse(BaseModel):
    scanId: str
    recommendations: List[RecommendationItem]

class ReportArtefactItem(BaseModel):
    artefactId: str
    name: str
    type: str
    location: dict
    quantumVulnerable: bool
    algorithmClass: str
    detectionMethod: str
    confidence: float
    businessCriticality: str
    dataLifetimeYears: int
    riskLevel: str
    recommendation: Optional[dict] = None

class ReportsSummaryResponse(BaseModel):
    scanId: str
    quantumRiskItems: List[ReportArtefactItem]
    legacyRiskItems: List[ReportArtefactItem]
