from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict, model_validator

class ScanTargets(BaseModel):
    sourceCode: bool = True
    binaries: bool = True
    dependencies: bool = True
    containers: bool = True

class ScanCreate(BaseModel):
    sourceType: Optional[str] = None # github, local, upload, image
    type: Optional[str] = None
    target: str
    scanTargets: ScanTargets = ScanTargets()
    exposureTag: Optional[str] = None # internal, external
    exposure: Optional[str] = None

    @model_validator(mode="after")
    def normalize_fields(self):
        resolved_source = self.sourceType or self.type
        if not resolved_source:
            if self.target.startswith("http://") or self.target.startswith("https://") or "github.com" in self.target:
                resolved_source = "github"
            else:
                resolved_source = "local"
        self.sourceType = resolved_source
        self.type = resolved_source

        resolved_exp = self.exposureTag or self.exposure or "internal"
        self.exposureTag = resolved_exp
        self.exposure = resolved_exp
        return self

class ScanResponse(BaseModel):
    id: str
    status: str
    sourceType: str
    target: str
    exposureTag: str
    progress: int
    currentStage: str
    artefactsFound: int
    createdAt: str
    completedAt: Optional[str] = None

class ScanStatusResponse(BaseModel):
    id: str
    status: str
    progress: int
    currentStage: str
    artefactsFound: int
    error: Optional[str] = None
    elapsedSeconds: float

class ScanListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    scans: List[ScanResponse]
