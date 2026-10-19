from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Artefact(Base):
    __tablename__ = "artefacts"

    id = Column(String, primary_key=True, index=True)
    scan_id = Column(String, ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False)

    name = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False) # algorithm, key, certificate, protocol, library, cloud_service, hardware_module
    algorithm_class = Column(String, nullable=False) # asymmetric, symmetric, hash

    # Location
    source_origin = Column(String, default="source") # source, binary, container, dependency
    path = Column(String, nullable=False, index=True)
    line = Column(Integer, nullable=True)

    # Discovery metadata
    confidence = Column(Float, default=1.0)
    detection_method = Column(String, nullable=False) # regex_pattern, ast, dependency_manifest, x509_parse, config_parse, binary_signature
    evidence = Column(Text, nullable=True)
    key_size = Column(Integer, nullable=True)
    mode = Column(String, nullable=True)
    version = Column(String, nullable=True)
    library = Column(String, nullable=True)
    oid = Column(String, nullable=True)

    # Risk analysis & Mosca
    quantum_vulnerable = Column(Boolean, default=False)
    risk_level = Column(String, default="low", index=True) # critical, high, medium, low
    business_criticality = Column(String, default="medium") # low, medium, high, critical
    shelf_life_years = Column(Integer, default=10)
    migration_time_years = Column(Integer, default=5)
    mosca_verdict = Column(String, default="within_window") # violated, within_window, broken_today, quantum_safe
    mosca_margin = Column(Integer, default=0)
    priority_score = Column(Integer, default=0)

    # Recommendations
    replacement = Column(String, nullable=True)
    latency_note = Column(String, nullable=True)
    cost_note = Column(String, nullable=True)
    alternatives = Column(JSON, nullable=True) # list of structured alternative objects

    # Relationship
    scan = relationship("Scan", back_populates="artefacts")
