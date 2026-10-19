import os
from pathlib import Path
from typing import List
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa, dsa, ec, ed25519, ed448
from backend.app.scanners.base import BaseScanner, CryptoAssetResult

CERT_EXTENSIONS = {".pem", ".crt", ".cer", ".key", ".p12", ".jks"}

PRIVATE_KEY_HEADERS = [
    "BEGIN RSA PRIVATE KEY",
    "BEGIN PRIVATE KEY",
    "BEGIN EC PRIVATE KEY",
    "BEGIN DSA PRIVATE KEY",
    "BEGIN OPENSSH PRIVATE KEY",
    "BEGIN ENCRYPTED PRIVATE KEY",
]

class CertKeyScanner(BaseScanner):
    def scan(self, target_dir: Path) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []

        for root, dirs, files in os.walk(target_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ["node_modules", "vendor", "__pycache__", ".venv", "venv"]]

            for file_name in files:
                file_path = Path(root) / file_name
                ext = file_path.suffix.lower()

                if ext not in CERT_EXTENSIONS and "cert" not in file_name.lower() and "key" not in file_name.lower():
                    continue

                rel_path = str(file_path.relative_to(target_dir)).replace("\\", "/")

                try:
                    with open(file_path, "rb") as f:
                        data = f.read()
                except Exception:
                    continue

                # 1. Check for committed private keys (secret exposure)
                self._check_private_key(data, rel_path, results)

                # 2. Check for X.509 certificates
                self._parse_x509_certificate(data, rel_path, results)

        return results

    def _check_private_key(self, data: bytes, rel_path: str, results: List[CryptoAssetResult]):
        text = data.decode("utf-8", errors="ignore")
        for header in PRIVATE_KEY_HEADERS:
            if header in text:
                algo_name = "RSA"
                key_size = 2048
                if "EC" in header:
                    algo_name = "ECDSA P-256"
                    key_size = 256
                elif "DSA" in header:
                    algo_name = "DSA-1024"
                    key_size = 1024

                results.append(CryptoAssetResult(
                    name=f"Committed Private Key ({algo_name})",
                    type="key",
                    algorithm_class="asymmetric",
                    path=rel_path,
                    source_origin="source",
                    confidence=1.0,
                    detection_method="x509_parse",
                    evidence=f"Exposed Secret: '-----{header}-----'",
                    key_size=key_size
                ))
                break

    def _parse_x509_certificate(self, data: bytes, rel_path: str, results: List[CryptoAssetResult]):
        try:
            cert = None
            if b"BEGIN CERTIFICATE" in data:
                cert = x509.load_pem_x509_certificate(data, default_backend())
            else:
                # Try DER
                try:
                    cert = x509.load_der_x509_certificate(data, default_backend())
                except Exception:
                    pass

            if not cert:
                return

            pub_key = cert.public_key()
            algo_name = "Unknown"
            algo_class = "asymmetric"
            key_size = None

            if isinstance(pub_key, rsa.RSAPublicKey):
                key_size = pub_key.key_size
                algo_name = f"RSA-{key_size}"
            elif isinstance(pub_key, ec.EllipticCurvePublicKey):
                key_size = pub_key.key_size
                curve_name = pub_key.curve.name
                algo_name = f"ECDSA ({curve_name})"
            elif isinstance(pub_key, dsa.DSAPublicKey):
                key_size = pub_key.key_size
                algo_name = f"DSA-{key_size}"
            elif isinstance(pub_key, ed25519.Ed25519PublicKey):
                key_size = 256
                algo_name = "Ed25519"
            elif isinstance(pub_key, ed448.Ed448PublicKey):
                key_size = 448
                algo_name = "Ed448"

            sig_hash = cert.signature_hash_algorithm.name if cert.signature_hash_algorithm else "None"
            evidence = f"Issuer: {cert.issuer.rfc4514_string()}; SigHash: {sig_hash}; Validity: {cert.not_valid_after_utc.strftime('%Y-%m-%d')}"

            results.append(CryptoAssetResult(
                name=algo_name,
                type="certificate",
                algorithm_class=algo_class,
                path=rel_path,
                source_origin="source",
                confidence=1.0,
                detection_method="x509_parse",
                evidence=evidence[:160],
                key_size=key_size
            ))
        except Exception:
            pass
