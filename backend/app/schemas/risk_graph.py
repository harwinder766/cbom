from typing import List
from pydantic import BaseModel, Field

class GraphNode(BaseModel):
    id: str
    label: str
    type: str # system, library, artefact
    riskLevel: str # critical, high, medium, low, none
    description: str

class GraphEdge(BaseModel):
    id: str
    from_: str = Field(..., alias="from")
    to: str
    riskLevel: str

    model_config = {
        "populate_by_name": True
    }

class RiskGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
