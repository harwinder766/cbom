import sys
from pathlib import Path
import uvicorn

# Add repo root to python path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.app.config import settings

if __name__ == "__main__":
    app_dir = Path(__file__).resolve().parent / "app"
    print(f"Starting ECDAT Backend on {settings.host}:{settings.port} ...")
    uvicorn.run(
        "backend.app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        reload_dirs=[str(app_dir)],
        reload_excludes=["uploads", "workspaces", "*.db", "*/uploads/*", "*/workspaces/*", "cbom.db*"]
    )
