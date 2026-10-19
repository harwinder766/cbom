from typing import Optional, List
from pydantic import BaseModel

class GlobalMoscaParams(BaseModel):
    quantumArrivalYears: int
    defaultShelfLifeYears: int
    defaultMigrationTimeYears: int

class RiskSummaryStats(BaseModel):
    totalEvaluated: int
    violatedCount: int
    withinWindowCount: int
    classicallyBrokenCount: int
    quantumSafeCount: int
    averagePriorityScore: float

class TopRiskFinding(BaseModel):
    artefactId: str
    name: str
    location: str
    shelfLifeYears: int
    migrationTimeYears: int
    quantumArrivalYears: int
    deficitYears: int
    verdict: str
    priorityScore: int

class RiskSummaryResponse(BaseModel):
    scanId: str
    globalParams: GlobalMoscaParams
    summary: RiskSummaryStats
    topRisks: List[TopRiskFinding]

class RecalculateRiskRequest(BaseModel):
    quantumArrivalYears: Optional[int] = None
    shelfLifeYears: Optional[int] = None
    migrationTimeYears: Optional[int] = None
