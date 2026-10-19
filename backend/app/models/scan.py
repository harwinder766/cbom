import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Scan(Base):
    __tablename__ = "scans"

    id = Column(String, primary_key=True, index=True)
    source_type = Column(String, nullable=False) # github, local, upload, image
    target = Column(String, nullable=False)
    exposure_tag = Column(String, default="internal") # internal, external
    status = Column(String, default="queued") # queued, running, completed, failed
    progress = Column(Integer, default=0)
    current_stage = Column(String, default="Initializing workspace sandbox...")
    artefacts_found = Column(Integer, default=0)
    source_files_count = Column(Integer, default=0)
    error = Column(String, nullable=True)

    # Scan-level Mosca parameters (overridable via /recalculate)
    quantum_arrival_years = Column(Integer, default=12)
    default_shelf_life_years = Column(Integer, default=10)
    default_migration_time_years = Column(Integer, default=5)

    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    # Relationship to artefacts
    artefacts = relationship("Artefact", back_populates="scan", cascade="all, delete-orphan")
