import os
import re
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List
from backend.app.scanners.base import BaseScanner, CryptoAssetResult
from backend.app.services.knowledge_base import kb

class DependencyScanner(BaseScanner):
    def scan(self, target_dir: Path) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []

        for root, dirs, files in os.walk(target_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ["node_modules", "vendor", "__pycache__", ".venv", "venv"]]

            for file_name in files:
                file_path = Path(root) / file_name
                rel_path = str(file_path.relative_to(target_dir)).replace("\\", "/")

                if file_name == "requirements.txt":
                    results.extend(self._scan_requirements_txt(file_path, rel_path))
                elif file_name == "package.json":
                    results.extend(self._scan_package_json(file_path, rel_path))
                elif file_name == "pom.xml":
                    results.extend(self._scan_pom_xml(file_path, rel_path))
                elif file_name == "go.mod":
                    results.extend(self._scan_go_mod(file_path, rel_path))

        return results

    def _scan_requirements_txt(self, file_path: Path, rel_path: str) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
        except Exception:
            return results

        for idx, line in enumerate(lines, start=1):
            line_str = line.strip()
            if not line_str or line_str.startswith("#"):
                continue

            match = re.match(r"^([a-zA-Z0-9_\-\.]+)(?:[=><~!\s]+([a-zA-Z0-9_\-\.]+))?", line_str)
            if match:
                pkg = match.group(1).lower()
                version = match.group(2) or ""

                lib_meta = kb.lookup_library(pkg)
                if lib_meta:
                    name = f"{pkg} {version}".strip()
                    results.append(CryptoAssetResult(
                        name=name,
                        type="library",
                        algorithm_class="asymmetric",
                        path=rel_path,
                        line=idx,
                        source_origin="dependency",
                        confidence=0.99,
                        detection_method="dependency_manifest",
                        evidence=line_str,
                        version=version,
                        library=pkg
                    ))

        return results

    def _scan_package_json(self, file_path: Path, rel_path: str) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                data = json.load(f)
        except Exception:
            return results

        all_deps = {}
        all_deps.update(data.get("dependencies", {}))
        all_deps.update(data.get("devDependencies", {}))

        for pkg, ver in all_deps.items():
            clean_ver = re.sub(r"[^\d\.]", "", ver)
            lib_meta = kb.lookup_library(pkg)
            if lib_meta:
                name = f"{pkg} {clean_ver}".strip()
                results.append(CryptoAssetResult(
                    name=name,
                    type="library",
                    algorithm_class="asymmetric",
                    path=rel_path,
                    source_origin="dependency",
                    confidence=0.99,
                    detection_method="dependency_manifest",
                    evidence=f'"{pkg}": "{ver}"',
                    version=clean_ver,
                    library=pkg
                ))

        return results

    def _scan_pom_xml(self, file_path: Path, rel_path: str) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
        except Exception:
            return results

        # Strip XML namespaces for uniform querying
        for elem in root.iter():
            if "}" in elem.tag:
                elem.tag = elem.tag.split("}", 1)[1]

        for dep in root.findall(".//dependency"):
            group_id = dep.findtext("groupId", "").strip()
            artifact_id = dep.findtext("artifactId", "").strip()
            version = dep.findtext("version", "").strip()

            full_id = f"{group_id}:{artifact_id}"
            lib_meta = kb.lookup_library(full_id) or kb.lookup_library(artifact_id)
            if lib_meta:
                name = f"{artifact_id} {version}".strip()
                results.append(CryptoAssetResult(
                    name=name,
                    type="library",
                    algorithm_class="asymmetric",
                    path=rel_path,
                    source_origin="dependency",
                    confidence=0.99,
                    detection_method="dependency_manifest",
                    evidence=f"<artifactId>{artifact_id}</artifactId><version>{version}</version>",
                    version=version,
                    library=full_id
                ))

        return results

    def _scan_go_mod(self, file_path: Path, rel_path: str) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
        except Exception:
            return results

        for idx, line in enumerate(lines, start=1):
            line_str = line.strip()
            match = re.search(r"^\s*([a-zA-Z0-9_\-\./]+)\s+([vV0-9\.\-]+)", line_str)
            if match:
                mod = match.group(1)
                ver = match.group(2)
                lib_meta = kb.lookup_library(mod)
                if lib_meta:
                    results.append(CryptoAssetResult(
                        name=f"{mod} {ver}",
                        type="library",
                        algorithm_class="asymmetric",
                        path=rel_path,
                        line=idx,
                        source_origin="dependency",
                        confidence=0.99,
                        detection_method="dependency_manifest",
                        evidence=line_str,
                        version=ver,
                        library=mod
                    ))

        return results
