from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None

class ErrorResponse(BaseModel):
    error: ErrorDetail

class Location(BaseModel):
    source: str # source, binary, container, dependency
    path: str
    line: Optional[int] = None

class RecommendationAlternative(BaseModel):
    nistStandard: str
    isHybrid: bool
    relativeLatency: float
    keySizeBytes: int
    signatureSizeBytes: int
    relativeCost: str
    rationale: str

class Recommendation(BaseModel):
    replacement: str
    latencyNote: str
    costNote: str
    alternatives: List[RecommendationAlternative] = []

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
