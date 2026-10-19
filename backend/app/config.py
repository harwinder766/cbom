import os
import tempfile
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    port: int = 8000
    host: str = "0.0.0.0"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    database_url: str = f"sqlite:///{BASE_DIR / 'cbom.db'}"
    upload_dir: str = str(Path(tempfile.gettempdir()) / "cbom_uploads")
    workspace_dir: str = str(Path(tempfile.gettempdir()) / "cbom_workspaces")
    data_dir: str = str(BASE_DIR / "data")
    allow_local_scans: bool = True
    dev_mode: bool = True
    allowlisted_roots: str = str(Path(__file__).resolve().parent.parent.parent)
    max_upload_size_bytes: int = 100 * 1024 * 1024  # 100 MB
    max_repo_clone_size_bytes: int = 250 * 1024 * 1024  # 250 MB
    scan_timeout_seconds: int = 300  # 5 minutes
    max_concurrent_scans: int = 3  # Maximum concurrent active scans
    max_zip_extracted_size_bytes: int = 250 * 1024 * 1024  # 250 MB
    max_zip_file_count: int = 10000
    default_crqc_years: int = 12
    default_shelf_life_years: int = 10
    default_migration_time_years: int = 5

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowlisted_roots_list(self) -> List[str]:
        return [Path(p.strip()).resolve() for p in self.allowlisted_roots.split(",") if p.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

settings = Settings()

# Ensure necessary directories exist
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Path(settings.workspace_dir).mkdir(parents=True, exist_ok=True)
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)

