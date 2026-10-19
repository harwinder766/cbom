import json
from pathlib import Path
import jsonschema
from backend.app.models.scan import Scan
from backend.app.models.artefact import Artefact
from backend.app.services.cbom_generator import (
    generate_cyclonedx_cbom,
    generate_csv_report,
    generate_html_report,
    generate_pdf_report
)

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "data" / "cyclonedx-1.6.schema.json"

def test_cyclonedx_1_6_schema_validation():
    """Validates generated CBOM strictly against official CycloneDX 1.6 JSON Schema."""
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = json.load(f)

    scan = Scan(id="scan_cdx_test", target="github.com/ntro/secure-gateway")
    artefacts = [
        Artefact(
            id="art_1",
            scan_id="scan_cdx_test",
            name="RSA-2048",
            type="key",
            algorithm_class="asymmetric",
            path="auth/jwt.py",
            line=12,
            key_size=2048,
            risk_level="critical",
            quantum_vulnerable=True,
            detection_method="ast",
            replacement="ML-DSA-65 (Dilithium3)"
        ),
        Artefact(
            id="art_2",
            scan_id="scan_cdx_test",
            name="AES-128-GCM",
            type="algorithm",
            algorithm_class="symmetric",
            mode="GCM",
            key_size=128,
            path="crypto/vault.py",
            line=45,
            risk_level="medium",
            quantum_vulnerable=False,
            detection_method="ast",
            replacement="AES-256-GCM"
        ),
        Artefact(
            id="art_3",
            scan_id="scan_cdx_test",
            name="Server TLS Certificate",
            type="certificate",
            path="certs/server.crt",
            line=1,
            risk_level="high",
            quantum_vulnerable=True,
            detection_method="x509_parser",
            replacement="Hybrid X.509 (Dilithium + ECDSA)"
        ),
        Artefact(
            id="art_4",
            scan_id="scan_cdx_test",
            name="TLS 1.0",
            type="protocol",
            version="1.0",
            path="nginx/ssl.conf",
            line=22,
            risk_level="critical",
            quantum_vulnerable=False,
            detection_method="config_directive",
            replacement="TLS 1.3"
        )
    ]

    cbom = generate_cyclonedx_cbom(scan, artefacts)

    # 1. Structure assertions
    assert cbom["bomFormat"] == "CycloneDX"
    assert cbom["specVersion"] == "1.6"
    assert len(cbom["components"]) == 4

    # 2. Strict jsonschema validation against official CycloneDX 1.6 schema
    jsonschema.validate(instance=cbom, schema=schema)

def test_csv_and_html_generation():
    scan = Scan(id="scan_test", target="test_target")
    artefacts = [
        Artefact(
            id="art_1",
            scan_id="scan_test",
            name="SHA-1",
            type="algorithm",
            algorithm_class="hash",
            path="legacy/hash.c",
            line=40,
            risk_level="high",
            business_criticality="high",
            quantum_vulnerable=False,
            detection_method="regex_pattern",
            replacement="SHA-256"
        )
    ]

    csv_out = generate_csv_report(artefacts)
    assert "Artefact ID,Name,Type" in csv_out
    assert "SHA-1" in csv_out

    html_out = generate_html_report(scan, artefacts)
    assert "<!DOCTYPE html>" in html_out
    assert "SHA-1" in html_out

def test_pdf_generation():
    """Validates PDF generation using ReportLab."""
    scan = Scan(id="scan_pdf_test", target="test_target_repo")
    artefacts = [
        Artefact(
            id="art_1",
            scan_id="scan_pdf_test",
            name="RSA-2048",
            type="key",
            algorithm_class="asymmetric",
            path="auth/jwt.py",
            line=12,
            risk_level="critical",
            quantum_vulnerable=True,
            detection_method="ast",
            replacement="ML-DSA-65"
        ),
        Artefact(
            id="art_2",
            scan_id="scan_pdf_test",
            name="AES-128",
            type="algorithm",
            algorithm_class="symmetric",
            path="crypto/cipher.py",
            line=30,
            risk_level="medium",
            quantum_vulnerable=False,
            detection_method="ast",
            replacement="AES-256"
        )
    ]

    pdf_bytes = generate_pdf_report(scan, artefacts)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 1000
