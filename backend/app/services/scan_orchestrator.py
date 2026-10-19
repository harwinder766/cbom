import os
import shutil
import tempfile
import zipfile
import subprocess
import datetime
import time
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models.scan import Scan
from backend.app.models.artefact import Artefact
from backend.app.scanners.source_scanner import SourceScanner
from backend.app.scanners.dependency_scanner import DependencyScanner
from backend.app.scanners.cert_key_scanner import CertKeyScanner
from backend.app.scanners.config_scanner import ConfigScanner
from backend.app.scanners.binary_scanner import BinaryScanner
from backend.app.scanners.container_scanner import ContainerScanner
from backend.app.services.knowledge_base import kb
from backend.app.services.risk_engine import infer_criticality_heuristically, calculate_mosca_risk
from backend.app.services.recommendation_engine import get_recommendation_for_asset

def run_scan_pipeline(scan_id: str):
    """
    Background worker executing the complete discovery and risk assessment pipeline.
    """
    db = SessionLocal()
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        db.close()
        return

    start_time = time.monotonic()

    def check_timeout():
        if time.monotonic() - start_time > settings.scan_timeout_seconds:
            raise TimeoutError(f"Scan exceeded maximum execution timeout limit of {settings.scan_timeout_seconds} seconds.")

    sandbox_dir = Path(tempfile.mkdtemp(prefix=f"cbom_scan_{scan_id}_", dir=settings.workspace_dir))

    try:
        # Phase 1: Preparation (10%)
        scan.status = "running"
        scan.progress = 10
        scan.current_stage = "Initializing workspace sandbox & extracting target..."
        db.commit()

        target_scan_dir = sandbox_dir

        if scan.source_type == "github":
            # Shallow clone with timeout and size check
            scan.current_stage = f"Cloning shallow Git tree: {scan.target}..."
            db.commit()
            clone_cmd = ["git", "clone", "--depth", "1", scan.target, str(sandbox_dir)]
            clone_timeout = min(120, settings.scan_timeout_seconds)
            try:
                subprocess.run(
                    clone_cmd,
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=clone_timeout
                )
            except subprocess.TimeoutExpired:
                raise TimeoutError(f"Git clone operation timed out after {clone_timeout} seconds.")
            except subprocess.CalledProcessError as e:
                err_text = e.stderr.decode("utf-8", errors="replace").strip() if e.stderr else str(e)
                raise RuntimeError(f"Git clone failed: {err_text}")

            # Enforce max cloned repository size limit
            total_clone_bytes = 0
            for root, _, files in os.walk(sandbox_dir):
                for f in files:
                    fp = os.path.join(root, f)
                    try:
                        total_clone_bytes += os.path.getsize(fp)
                    except OSError:
                        pass
            if total_clone_bytes > settings.max_repo_clone_size_bytes:
                limit_mb = settings.max_repo_clone_size_bytes // (1024 * 1024)
                cloned_mb = total_clone_bytes // (1024 * 1024)
                raise ValueError(f"Cloned repository size ({cloned_mb}MB) exceeds maximum allowed limit of {limit_mb}MB.")

        elif scan.source_type == "local":
            if not settings.allow_local_scans:
                raise PermissionError("Local path scans are disabled on this server instance for security.")
            # Security verification
            local_path = Path(scan.target).resolve()
            if not settings.dev_mode:
                allowed = any(str(local_path).startswith(str(r)) for r in settings.allowlisted_roots_list)
                if not allowed:
                    raise PermissionError(f"Local path '{scan.target}' is outside allowlisted scan roots.")

            if not local_path.exists():
                raise FileNotFoundError(f"Local path '{scan.target}' does not exist.")

            target_scan_dir = local_path

        elif scan.source_type == "upload":
            upload_source = Path(scan.target)
            if upload_source.is_file() and upload_source.suffix.lower() == ".zip":
                target_scan_dir = sandbox_dir
                total_uncompressed = 0
                max_uncompressed = settings.max_zip_extracted_size_bytes
                max_files = settings.max_zip_file_count

                with zipfile.ZipFile(upload_source, "r") as zip_ref:
                    for idx, info in enumerate(zip_ref.infolist()):
                        if idx >= max_files:
                            raise ValueError(f"Zip archive exceeds maximum allowed file count ({max_files}).")
                        total_uncompressed += info.file_size
                        if total_uncompressed > max_uncompressed:
                            raise ValueError(f"Zip archive uncompressed size exceeds limit of {max_uncompressed // (1024 * 1024)}MB.")
                        z_norm = info.filename.replace("\\", "/").strip()
                        if z_norm.startswith("/") or ":" in z_norm or ".." in Path(z_norm).parts:
                            raise ValueError(f"Zip-slip path traversal attempt: {info.filename}")
                        dest_path = (sandbox_dir / z_norm).resolve()
                        if not dest_path.is_relative_to(sandbox_dir.resolve()):
                            raise ValueError(f"Zip-slip path traversal attempt: {info.filename}")
                        zip_ref.extract(info, path=sandbox_dir)
            elif upload_source.is_dir():
                target_scan_dir = upload_source

            # Re-root to single top-level directory if present so paths match project root
            entries = [p for p in target_scan_dir.iterdir() if p.name not in ["__MACOSX", ".git", ".DS_Store"]]
            if len(entries) == 1 and entries[0].is_dir():
                target_scan_dir = entries[0]

        elif scan.source_type == "image":
            # Container tar or image name
            upload_source = Path(scan.target)
            if upload_source.exists() and upload_source.suffix.lower() == ".tar":
                shutil.copy2(upload_source, sandbox_dir / upload_source.name)
            else:
                # Try docker save if docker available
                try:
                    subprocess.run(["docker", "save", scan.target, "-o", str(sandbox_dir / "image.tar")], check=True, timeout=180)
                except Exception:
                    raise RuntimeError(f"Cannot acquire container image '{scan.target}'. Provide a docker save tarball.")

        # Phase 2: Source Code Analysis (35%)
        check_timeout()
        scan.progress = 30
        scan.current_stage = "Scanning source code ASTs and regex patterns..."
        db.commit()

        source_scanner = SourceScanner()
        raw_findings = source_scanner.scan(target_scan_dir)

        scan.artefacts_found = len(raw_findings)
        scan.progress = 50
        scan.current_stage = "Scanning dependency trees & SBOM manifests..."
        db.commit()

        # Phase 3: Dependencies
        check_timeout()
        dep_scanner = DependencyScanner()
        raw_findings.extend(dep_scanner.scan(target_scan_dir))

        scan.artefacts_found = len(raw_findings)
        scan.progress = 65
        scan.current_stage = "Scanning certificates, committed keys & server configs..."
        db.commit()

        # Phase 4: Certificates, Keys & Configs
        check_timeout()
        cert_scanner = CertKeyScanner()
        raw_findings.extend(cert_scanner.scan(target_scan_dir))

        config_scanner = ConfigScanner()
        raw_findings.extend(config_scanner.scan(target_scan_dir))

        scan.artefacts_found = len(raw_findings)
        scan.progress = 80
        scan.current_stage = "Scanning binary headers, symbol tables & container layers..."
        db.commit()

        # Phase 5: Binaries & Container images
        check_timeout()
        bin_scanner = BinaryScanner()
        raw_findings.extend(bin_scanner.scan(target_scan_dir))

        cont_scanner = ContainerScanner()
        raw_findings.extend(cont_scanner.scan(target_scan_dir))

        # Phase 6: Mosca Risk Evaluation & Recommendation Mapping (90%)
        check_timeout()
        scan.progress = 90
        scan.current_stage = "Applying Mosca's inequality & NIST PQC recommendation mapping..."
        db.commit()

        # Count unique source files
        unique_files = set(f.path for f in raw_findings)
        scan.source_files_count = len(unique_files)

        # Persist discoveries as Artefacts
        for idx, f in enumerate(raw_findings, start=1):
            art_id = f"art_{scan_id}_{idx:03d}"

            # KB lookup for quantum status
            kb_entry = kb.lookup_algorithm(f.name)
            quantum_status = kb_entry.get("quantumStatus", "quantum_safe") if kb_entry else "quantum_safe"
            is_quantum_vuln = quantum_status in ["shor_vulnerable", "grover_weakened"]
            oid = f.oid or (kb_entry.get("oid") if kb_entry else None)

            # Criticality & Mosca calculation
            crit = infer_criticality_heuristically(f.path, f.name, f.type)
            shelf_life = scan.default_shelf_life_years
            mig_time = scan.default_migration_time_years

            risk_eval = calculate_mosca_risk(
                name=f.name,
                path=f.path,
                algo_type=f.type,
                quantum_status=quantum_status,
                business_criticality=crit,
                shelf_life_years=shelf_life,
                migration_time_years=mig_time,
                quantum_arrival_years=scan.quantum_arrival_years,
                exposure_tag=scan.exposure_tag
            )

            # Recommendations
            rec_data = get_recommendation_for_asset(f.name)

            artefact = Artefact(
                id=art_id,
                scan_id=scan.id,
                name=f.name,
                type=f.type,
                algorithm_class=f.algorithm_class,
                source_origin=f.source_origin,
                path=f.path,
                line=f.line,
                confidence=f.confidence,
                detection_method=f.detection_method,
                evidence=f.evidence,
                key_size=f.key_size,
                mode=f.mode,
                version=f.version,
                library=f.library,
                oid=oid,
                quantum_vulnerable=is_quantum_vuln,
                risk_level=risk_eval["risk_level"],
                business_criticality=crit,
                shelf_life_years=shelf_life,
                migration_time_years=mig_time,
                mosca_verdict=risk_eval["verdict"],
                mosca_margin=risk_eval["margin"],
                priority_score=risk_eval["priority_score"],
                replacement=rec_data["replacement"] if rec_data else None,
                latency_note=rec_data["latencyNote"] if rec_data else None,
                cost_note=rec_data["costNote"] if rec_data else None,
                alternatives=rec_data["alternatives"] if rec_data else []
            )
            db.add(artefact)

        scan.artefacts_found = len(raw_findings)
        scan.progress = 100
        scan.current_stage = "Done."
        scan.status = "completed"
        scan.completed_at = datetime.datetime.now(datetime.timezone.utc)
        db.commit()

    except Exception as e:
        scan.status = "failed"
        scan.error = str(e)
        scan.current_stage = f"Failed: {str(e)}"
        db.commit()
    finally:
        source_type = scan.source_type if scan else ""
        db.close()
        # Clean up temporary sandbox
        if source_type in ["github", "upload", "image"]:
            shutil.rmtree(sandbox_dir, ignore_errors=True)
