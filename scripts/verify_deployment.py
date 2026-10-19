import os
import sys
import time
import io
import zipfile
import requests

BASE_URL = "http://localhost:8000"

def log(msg):
    print(f"[VERIFY] {msg}", flush=True)

def main():
    log("Waiting for backend server to be healthy...")
    for _ in range(20):
        try:
            r = requests.get(f"{BASE_URL}/api/health", timeout=2)
            if r.status_code == 200:
                log(f"Backend is UP: {r.json()}")
                break
        except Exception:
            time.sleep(0.5)
    else:
        log("Backend failed to respond in time.")
        sys.exit(1)

    # 1. Verify GET /api/config
    log("1. Testing GET /api/config ...")
    r_config = requests.get(f"{BASE_URL}/api/config")
    assert r_config.status_code == 200, f"Config failed: {r_config.text}"
    cfg = r_config.json()
    log(f"   Config received: {cfg}")
    assert cfg["allowLocalScans"] is False, f"Expected allowLocalScans=False, got {cfg['allowLocalScans']}"

    # 2. Verify Local scan rejection when ALLOW_LOCAL_SCANS=false
    log("2. Testing local scan rejection with ALLOW_LOCAL_SCANS=false ...")
    r_local = requests.post(f"{BASE_URL}/api/scans", json={
        "sourceType": "local",
        "target": "backend/tests/fixtures/sample_repo",
        "scanTargets": {"sourceCode": True},
        "exposureTag": "internal"
    })
    log(f"   Response status: {r_local.status_code}, body: {r_local.text}")
    assert r_local.status_code == 403, f"Expected 403, got {r_local.status_code}"
    assert r_local.json()["error"]["code"] == "LOCAL_PATH_FORBIDDEN"

    # 3. Test GitHub scan of small public repo
    log("3. Testing GitHub scan of https://github.com/octocat/Hello-World ...")
    r_gh = requests.post(f"{BASE_URL}/api/scans", json={
        "sourceType": "github",
        "target": "https://github.com/octocat/Hello-World",
        "scanTargets": {"sourceCode": True, "dependencies": True},
        "exposureTag": "internal"
    })
    assert r_gh.status_code == 201, f"GitHub scan creation failed: {r_gh.text}"
    gh_scan_id = r_gh.json()["id"]
    log(f"   GitHub scan started with ID: {gh_scan_id}")

    for _ in range(60):
        st = requests.get(f"{BASE_URL}/api/scans/{gh_scan_id}/status").json()
        log(f"   GitHub scan progress: {st.get('progress')}% - {st.get('currentStage')}")
        if st.get("status") in ["completed", "failed"]:
            break
        time.sleep(1)

    assert st["status"] == "completed", f"GitHub scan failed: {st}"
    log("   GitHub scan completed successfully!")

    # 4. Test Zip Upload Scan
    log("4. Testing Zip Upload Scan ...")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("auth/jwt.py", "import jwt\npublic_key = 'rsa'\njwt.decode(token, key=public_key, algorithms=['RS256'])\n")
        zf.writestr("crypto/legacy.py", "import hashlib\nhashlib.md5(b'test').hexdigest()\nhashlib.sha1(b'test').hexdigest()\n")
        zf.writestr("package.json", '{"dependencies": {"crypto-js": "^4.1.1"}}\n')
    buf.seek(0)

    files = [("files", ("crypto_demo.zip", buf.getvalue(), "application/zip"))]
    r_up = requests.post(f"{BASE_URL}/api/scans/upload", files=files, data={"exposureTag": "internal"})
    assert r_up.status_code == 201, f"Upload scan creation failed: {r_up.text}"
    zip_scan_id = r_up.json()["id"]
    log(f"   Zip scan started with ID: {zip_scan_id}")

    for _ in range(60):
        st = requests.get(f"{BASE_URL}/api/scans/{zip_scan_id}/status").json()
        log(f"   Zip scan progress: {st.get('progress')}% - {st.get('currentStage')}")
        if st.get("status") in ["completed", "failed"]:
            break
        time.sleep(1)

    assert st["status"] == "completed", f"Zip scan failed: {st}"
    log(f"   Zip scan completed with {st['artefactsFound']} artefacts found!")
    assert st["artefactsFound"] >= 3, f"Expected at least 3 findings, got {st['artefactsFound']}"

    # 5. Test Downloads of All Four Report Formats
    log("5. Testing downloads of all four report formats for zip scan ...")

    # 5a. CycloneDX 1.6 CBOM JSON
    r_cbom = requests.get(f"{BASE_URL}/api/scans/{zip_scan_id}/report?format=cbom")
    assert r_cbom.status_code == 200, f"CBOM export failed: {r_cbom.text}"
    assert "application/json" in r_cbom.headers.get("content-type", "")
    cbom_data = r_cbom.json()
    assert cbom_data.get("bomFormat") == "CycloneDX"
    assert cbom_data.get("specVersion") == "1.6"
    assert len(cbom_data.get("components", [])) > 0
    log(f"   CycloneDX 1.6 CBOM: OK ({len(cbom_data['components'])} components)")

    # 5b. CSV
    r_csv = requests.get(f"{BASE_URL}/api/scans/{zip_scan_id}/report?format=csv")
    assert r_csv.status_code == 200, f"CSV export failed: {r_csv.text}"
    assert "text/csv" in r_csv.headers.get("content-type", "")
    assert "Artefact ID,Name,Type" in r_csv.text
    log(f"   CSV Report: OK ({len(r_csv.text.splitlines())} lines)")

    # 5c. HTML
    r_html = requests.get(f"{BASE_URL}/api/scans/{zip_scan_id}/report?format=html")
    assert r_html.status_code == 200, f"HTML export failed: {r_html.text}"
    assert "text/html" in r_html.headers.get("content-type", "")
    assert "<!DOCTYPE html>" in r_html.text
    log(f"   HTML Report: OK ({len(r_html.text)} characters)")

    # 5d. PDF
    r_pdf = requests.get(f"{BASE_URL}/api/scans/{zip_scan_id}/report?format=pdf")
    assert r_pdf.status_code == 200, f"PDF export failed: {r_pdf.text}"
    assert "application/pdf" in r_pdf.headers.get("content-type", "")
    assert r_pdf.content.startswith(b"%PDF-")
    log(f"   PDF Report: OK ({len(r_pdf.content)} bytes)")

    log("ALL 5 VERIFICATION CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    main()
