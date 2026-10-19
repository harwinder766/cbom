from typing import Optional, List
from pydantic import BaseModel
from backend.app.schemas.common import Location, Recommendation

class ArtefactResponse(BaseModel):
    id: str
    name: str
    type: str # algorithm, key, certificate, protocol, library, cloud_service, hardware_module
    location: Location
    quantumVulnerable: bool
    algorithmClass: str # asymmetric, symmetric, hash
    confidence: float
    riskLevel: str # critical, high, medium, low
    detectionMethod: str # regex_pattern, ast, dependency_manifest, x509_parse, config_parse, binary_signature
    evidence: Optional[str] = None
    keySize: Optional[int] = None
    mode: Optional[str] = None
    version: Optional[str] = None
    library: Optional[str] = None
    oid: Optional[str] = None
    businessCriticality: str
    dataLifetimeYears: int
    shelfLifeYears: int
    migrationTimeYears: int
    moscaVerdict: str
    moscaMargin: int
    priorityScore: int
    recommendation: Optional[Recommendation] = None

class ArtefactUpdate(BaseModel):
    businessCriticality: Optional[str] = None # low, medium, high, critical
    shelfLifeYears: Optional[int] = None
    migrationTimeYears: Optional[int] = None

class ArtefactListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    artefacts: List[ArtefactResponse]
