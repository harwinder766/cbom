import os
import tarfile
import tempfile
import shutil
from pathlib import Path
from typing import List
from backend.app.scanners.base import BaseScanner, CryptoAssetResult
from backend.app.scanners.source_scanner import SourceScanner
from backend.app.scanners.dependency_scanner import DependencyScanner
from backend.app.scanners.cert_key_scanner import CertKeyScanner
from backend.app.scanners.config_scanner import ConfigScanner
from backend.app.scanners.binary_scanner import BinaryScanner

class ContainerScanner(BaseScanner):
    def scan(self, target_dir: Path) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []

        # Find any container layer tarballs or Dockerfiles
        tar_files = list(target_dir.glob("*.tar")) + list(target_dir.glob("**/*.tar"))

        for tar_file in tar_files:
            # Safe extraction of tar layers
            extract_dir = Path(tempfile.mkdtemp(prefix="cbom_container_"))
            try:
                self._safe_extract_tar(tar_file, extract_dir)

                # Check if this is a docker save image archive (manifest.json + layer.tar files)
                manifest_file = extract_dir / "manifest.json"
                if manifest_file.exists():
                    # Unpack sub-layer archives
                    for layer_tar in extract_dir.glob("**/layer.tar"):
                        layer_dest = extract_dir / f"layer_{layer_tar.parent.name}"
                        layer_dest.mkdir(exist_ok=True)
                        self._safe_extract_tar(layer_tar, layer_dest)

                # Run file/dependency/cert/binary scanners over the container filesystem
                scanners = [
                    SourceScanner(),
                    DependencyScanner(),
                    CertKeyScanner(),
                    ConfigScanner(),
                    BinaryScanner(),
                ]

                for scanner in scanners:
                    sub_results = scanner.scan(extract_dir)
                    for item in sub_results:
                        item.source_origin = "container"
                        # Normalize path relative to container root
                        item.path = f"container://{tar_file.name}/{item.path}"
                        results.append(item)

            except Exception:
                pass
            finally:
                shutil.rmtree(extract_dir, ignore_errors=True)

        return results

    def _safe_extract_tar(self, tar_path: Path, dest_dir: Path):
        """Extracts tarball safely preventing path traversal attacks."""
        with tarfile.open(tar_path, "r:*") as tar:
            for member in tar.getmembers():
                member_path = dest_dir / member.name
                # Security check: Ensure member destination is within dest_dir
                if not str(member_path.resolve()).startswith(str(dest_dir.resolve())):
                    continue
                try:
                    tar.extract(member, path=dest_dir)
                except Exception:
                    pass
