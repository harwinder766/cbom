import time
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)
FIXTURES_DIR = str(Path(__file__).resolve().parent / "fixtures" / "sample_repo")

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "timestamp" in data

def test_full_scan_pipeline_e2e():
    # 1. Start scan on local fixture repo
    scan_req = {
        "sourceType": "local",
        "target": FIXTURES_DIR,
        "scanTargets": {
            "sourceCode": True,
            "binaries": True,
            "dependencies": True,
            "containers": True
        },
        "exposureTag": "internal"
    }
    res = client.post("/api/scans", json=scan_req)
    assert res.status_code == 201, res.text
    scan_data = res.json()
    scan_id = scan_data["id"]
    assert scan_data["status"] == "queued"

    # 2. Poll until completed (timeout 15s)
    for _ in range(30):
        status_res = client.get(f"/api/scans/{scan_id}/status")
        assert status_res.status_code == 200
        st = status_res.json()
        if st["status"] in ["completed", "failed"]:
            break
        time.sleep(0.5)

    assert st["status"] == "completed", f"Scan failed or timed out: {st}"
    assert st["artefactsFound"] > 0, "Scan must find artefacts in sample_repo"

    # 3. Test Dashboard Endpoint
    dash_res = client.get(f"/api/scans/{scan_id}/dashboard")
    assert dash_res.status_code == 200
    dash = dash_res.json()
    assert dash["totalArtefacts"] == st["artefactsFound"]
    assert dash["criticalCount"] > 0
    assert len(dash["recentFindings"]) > 0

    # 4. Test Latest Shortcut
    latest_res = client.get("/api/scans/latest/dashboard")
    assert latest_res.status_code == 200
    assert latest_res.json()["scanId"] == scan_id

    # 5. Test Artefacts Filtering & Pagination
    art_res = client.get(f"/api/scans/{scan_id}/artefacts?limit=10&offset=0")
    assert art_res.status_code == 200
    art_data = art_res.json()
    assert art_data["total"] > 0
    assert len(art_data["artefacts"]) <= 10

    first_art = art_data["artefacts"][0]
    art_id = first_art["id"]

    # 6. Test Get Single Artefact
    single_res = client.get(f"/api/artefacts/{art_id}")
    assert single_res.status_code == 200
    assert single_res.json()["id"] == art_id

    # 7. Test Patch Artefact (Criticality Override)
    patch_res = client.patch(f"/api/artefacts/{art_id}", json={
        "businessCriticality": "critical",
        "shelfLifeYears": 20
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["businessCriticality"] == "critical"
    assert updated["shelfLifeYears"] == 20

    # 8. Test Risk Graph (Deterministic structure without x, y)
    graph_res = client.get(f"/api/scans/{scan_id}/risk-graph")
    assert graph_res.status_code == 200
    graph = graph_res.json()
    assert len(graph["nodes"]) > 0
    assert len(graph["edges"]) > 0
    # Ensure x and y are not emitted by backend
    assert "x" not in graph["nodes"][0]

    # 9. Test Recommendations
    rec_res = client.get(f"/api/scans/{scan_id}/recommendations")
    assert rec_res.status_code == 200
    recs = rec_res.json()
    assert len(recs["recommendations"]) > 0

    # 10. Test Reports Summary
    summary_res = client.get(f"/api/scans/{scan_id}/reports-summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert len(summary["quantumRiskItems"]) > 0

    # 11. Test Export CBOM JSON
    cbom_res = client.get(f"/api/scans/{scan_id}/report?format=cbom")
    assert cbom_res.status_code == 200
    assert cbom_res.headers["content-type"].startswith("application/json")
    cbom_json = cbom_res.json()
    assert cbom_json["bomFormat"] == "CycloneDX"

    # 12. Test Export CSV
    csv_res = client.get(f"/api/scans/{scan_id}/report?format=csv")
    assert csv_res.status_code == 200
    assert csv_res.headers["content-type"].startswith("text/csv")

    # 13. Test Export HTML
    html_res = client.get(f"/api/scans/{scan_id}/report?format=html")
    assert html_res.status_code == 200
    assert "<!DOCTYPE html>" in html_res.text

    # 14. Test Export PDF
    pdf_res = client.get(f"/api/scans/{scan_id}/report?format=pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"].startswith("application/pdf")
    assert pdf_res.content.startswith(b"%PDF-")


def test_startup_interrupted_scans_marked_failed():
    """Verify that queued or running scans are marked failed on server restart."""
    import uuid
    import datetime
    from backend.app.database import SessionLocal
    from backend.app.models.scan import Scan
    from backend.app.main import fail_interrupted_scans

    db = SessionLocal()
    scan_q_id = f"test_q_{uuid.uuid4().hex[:6]}"
    scan_r_id = f"test_r_{uuid.uuid4().hex[:6]}"
    scan_c_id = f"test_c_{uuid.uuid4().hex[:6]}"

    scan_q = Scan(
        id=scan_q_id,
        source_type="local",
        target="/tmp/test_q",
        status="queued",
        current_stage="Queued...",
        created_at=datetime.datetime.now(datetime.timezone.utc)
    )
    scan_r = Scan(
        id=scan_r_id,
        source_type="local",
        target="/tmp/test_r",
        status="running",
        current_stage="Scanning...",
        created_at=datetime.datetime.now(datetime.timezone.utc)
    )
    scan_c = Scan(
        id=scan_c_id,
        source_type="local",
        target="/tmp/test_c",
        status="completed",
        current_stage="Done.",
        created_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add_all([scan_q, scan_r, scan_c])
    db.commit()
    db.close()

    # Trigger recovery function as executed during startup/lifespan
    count = fail_interrupted_scans()
    assert count >= 2

    verify_db = SessionLocal()
    sq = verify_db.query(Scan).filter(Scan.id == scan_q_id).first()
    sr = verify_db.query(Scan).filter(Scan.id == scan_r_id).first()
    sc = verify_db.query(Scan).filter(Scan.id == scan_c_id).first()

    assert sq.status == "failed"
    assert sq.error == "interrupted by server restart"

    assert sr.status == "failed"
    assert sr.error == "interrupted by server restart"

    assert sc.status == "completed"
    assert sc.error is None

    # Cleanup test rows
    verify_db.delete(sq)
    verify_db.delete(sr)
    verify_db.delete(sc)
    verify_db.commit()
    verify_db.close()


def test_upload_folder_with_nested_paths():
    """Verify folder upload rebuilds directory structure and findings use relative paths."""
    files = [
        ("files", ("src/core/crypto.py", b"import hashlib\nhashlib.md5(b'test')", "text/plain")),
        ("files", ("package.json", b'{"dependencies": {"crypto-js": "3.1.9"}}', "application/json")),
    ]
    res = client.post("/api/scans/upload", files=files, data={"exposureTag": "internal"})
    assert res.status_code == 201, res.text
    scan_id = res.json()["id"]

    for _ in range(30):
        st = client.get(f"/api/scans/{scan_id}/status").json()
        if st["status"] in ["completed", "failed"]:
            break
        time.sleep(0.5)

    assert st["status"] == "completed", f"Scan failed: {st}"
    assert st["artefactsFound"] >= 2

    art_res = client.get(f"/api/scans/{scan_id}/artefacts")
    assert art_res.status_code == 200
    artefacts = art_res.json()["artefacts"]
    paths = [a["location"]["path"] for a in artefacts]
    assert any("src/core/crypto.py" in p for p in paths)
    assert any("package.json" in p for p in paths)


def test_upload_zip():
    """Verify zip archive upload extracts safely and reports relative paths."""
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("src/auth.py", "import hashlib\nhashlib.sha1(b'legacy')")
        zf.writestr("requirements.txt", "pycryptodome==3.10.1\n")
    buf.seek(0)

    files = [("files", ("test_project.zip", buf.getvalue(), "application/zip"))]
    res = client.post("/api/scans/upload", files=files, data={"exposureTag": "internal"})
    assert res.status_code == 201, res.text
    scan_id = res.json()["id"]

    for _ in range(30):
        st = client.get(f"/api/scans/{scan_id}/status").json()
        if st["status"] in ["completed", "failed"]:
            break
        time.sleep(0.5)

    assert st["status"] == "completed", f"Scan failed: {st}"
    assert st["artefactsFound"] >= 1

    art_res = client.get(f"/api/scans/{scan_id}/artefacts")
    assert art_res.status_code == 200
    artefacts = art_res.json()["artefacts"]
    paths = [a["location"]["path"] for a in artefacts]
    assert any("src/auth.py" in p for p in paths)


def test_upload_zip_slip_attempt_rejected():
    """Verify zip-slip path traversal in uploaded zip archive is rejected."""
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../evil.py", "malicious_content = True")
    buf.seek(0)

    files = [("files", ("malicious.zip", buf.getvalue(), "application/zip"))]
    res = client.post("/api/scans/upload", files=files, data={"exposureTag": "internal"})
    assert res.status_code == 400
    err = res.json()
    assert err["error"]["code"] == "ZIP_SLIP_DETECTED"


def test_upload_dot_dot_path_rejected():
    """Verify relative file paths containing '..' traversal are rejected."""
    files = [("files", ("../../evil.py", b"evil = True", "text/plain"))]
    res = client.post("/api/scans/upload", files=files, data={"exposureTag": "internal"})
    assert res.status_code == 400
    err = res.json()
    assert err["error"]["code"] == "PATH_TRAVERSAL_DETECTED"


def test_config_endpoint():
    """Verify GET /api/config exposes server configuration and flags."""
    res = client.get("/api/config")
    assert res.status_code == 200
    data = res.json()
    assert "allowLocalScans" in data
    assert "maxUploadSizeBytes" in data
    assert "maxRepoCloneSizeBytes" in data
    assert "scanTimeoutSeconds" in data
    assert "maxConcurrentScans" in data


def test_allow_local_scans_disabled_rejection():
    """Verify that when ALLOW_LOCAL_SCANS=False, local scans are rejected with 403."""
    from backend.app.config import settings
    orig = settings.allow_local_scans
    try:
        settings.allow_local_scans = False
        res = client.post("/api/scans", json={
            "sourceType": "local",
            "target": FIXTURES_DIR,
            "scanTargets": {"sourceCode": True},
            "exposureTag": "internal"
        })
        assert res.status_code == 403
        data = res.json()
        assert data["error"]["code"] == "LOCAL_PATH_FORBIDDEN"
        assert "disabled" in data["error"]["message"].lower()
    finally:
        settings.allow_local_scans = orig


def test_concurrency_limit_enforced():
    """Verify that when max_concurrent_scans is reached, new scans return 429."""
    import uuid
    import datetime
    from backend.app.config import settings
    from backend.app.database import SessionLocal
    from backend.app.models.scan import Scan

    db = SessionLocal()
    dummy_scan = Scan(
        id=f"test_conc_{uuid.uuid4().hex[:6]}",
        source_type="github",
        target="https://github.com/org/repo",
        status="running",
        current_stage="Busy...",
        created_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(dummy_scan)
    db.commit()

    orig_limit = settings.max_concurrent_scans
    try:
        settings.max_concurrent_scans = 1
        res = client.post("/api/scans", json={
            "sourceType": "github",
            "target": "https://github.com/org/repo2",
            "scanTargets": {"sourceCode": True},
            "exposureTag": "internal"
        })
        assert res.status_code == 429
        data = res.json()
        assert data["error"]["code"] == "CONCURRENCY_LIMIT_EXCEEDED"
    finally:
        settings.max_concurrent_scans = orig_limit
        db.delete(dummy_scan)
        db.commit()
        db.close()


