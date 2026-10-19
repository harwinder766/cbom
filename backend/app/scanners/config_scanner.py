import os
import re
from pathlib import Path
from typing import List
from backend.app.scanners.base import BaseScanner, CryptoAssetResult

CONFIG_FILES = {"nginx.conf", "httpd.conf", "apache2.conf", "sshd_config", "ssh_config", "openssl.cnf", "java.security"}
CONFIG_EXTENSIONS = {".conf", ".cnf", ".cfg", ".ini", ".yaml", ".yml"}

class ConfigScanner(BaseScanner):
    def scan(self, target_dir: Path) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []

        for root, dirs, files in os.walk(target_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ["node_modules", "vendor", "__pycache__", ".venv", "venv"]]

            for file_name in files:
                file_path = Path(root) / file_name
                ext = file_path.suffix.lower()

                if file_name.lower() not in CONFIG_FILES and ext not in CONFIG_EXTENSIONS:
                    continue

                rel_path = str(file_path.relative_to(target_dir)).replace("\\", "/")

                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                except Exception:
                    continue

                for idx, line in enumerate(lines, start=1):
                    line_str = line.strip()
                    if not line_str or line_str.startswith("#"):
                        continue

                    # 1. Check TLS Protocols
                    if re.search(r"ssl_protocols|TLSProtocols|SecurityProtocol", line_str, re.IGNORECASE):
                        if "TLSv1.0" in line_str or "TLSv1 " in line_str or "TLS 1.0" in line_str:
                            results.append(CryptoAssetResult(
                                name="TLS 1.0",
                                type="protocol",
                                algorithm_class="asymmetric",
                                path=rel_path,
                                line=idx,
                                source_origin="container" if "ingress" in rel_path or "k8s" in rel_path else "source",
                                confidence=0.98,
                                detection_method="config_parse",
                                evidence=line_str[:160],
                                version="1.0"
                            ))
                        if "TLSv1.1" in line_str or "TLS 1.1" in line_str:
                            results.append(CryptoAssetResult(
                                name="TLS 1.0", # grouped with legacy
                                type="protocol",
                                algorithm_class="asymmetric",
                                path=rel_path,
                                line=idx,
                                source_origin="container" if "ingress" in rel_path or "k8s" in rel_path else "source",
                                confidence=0.98,
                                detection_method="config_parse",
                                evidence=line_str[:160],
                                version="1.1"
                            ))
                        if "TLSv1.2" in line_str or "TLS 1.2" in line_str:
                            results.append(CryptoAssetResult(
                                name="TLS 1.2",
                                type="protocol",
                                algorithm_class="asymmetric",
                                path=rel_path,
                                line=idx,
                                source_origin="container" if "ingress" in rel_path or "k8s" in rel_path else "source",
                                confidence=0.95,
                                detection_method="config_parse",
                                evidence=line_str[:160],
                                version="1.2"
                            ))

                    # 2. Check Cipher Suites
                    if re.search(r"ssl_ciphers|SSLCipherSuite|ciphers", line_str, re.IGNORECASE):
                        if re.search(r"\bRC4\b", line_str, re.IGNORECASE):
                            results.append(CryptoAssetResult(
                                name="RC4",
                                type="algorithm",
                                algorithm_class="symmetric",
                                path=rel_path,
                                line=idx,
                                source_origin="source",
                                confidence=0.96,
                                detection_method="config_parse",
                                evidence=line_str[:160]
                            ))
                        if re.search(r"\b(?:3DES|DES-CBC3-SHA)\b", line_str, re.IGNORECASE):
                            results.append(CryptoAssetResult(
                                name="3DES",
                                type="algorithm",
                                algorithm_class="symmetric",
                                path=rel_path,
                                line=idx,
                                source_origin="source",
                                confidence=0.96,
                                detection_method="config_parse",
                                evidence=line_str[:160]
                            ))
                        if re.search(r"\b(?:DHE-RSA|EDH-RSA|ECDHE-RSA)\b", line_str, re.IGNORECASE):
                            results.append(CryptoAssetResult(
                                name="Diffie-Hellman",
                                type="protocol",
                                algorithm_class="asymmetric",
                                path=rel_path,
                                line=idx,
                                source_origin="source",
                                confidence=0.95,
                                detection_method="config_parse",
                                evidence=line_str[:160]
                            ))

                    # 3. Check SSH Key Types / KEX
                    if re.search(r"KexAlgorithms|HostKeyAlgorithms|Ciphers", line_str, re.IGNORECASE):
                        if "diffie-hellman-group1-sha1" in line_str:
                            results.append(CryptoAssetResult(
                                name="Diffie-Hellman",
                                type="protocol",
                                algorithm_class="asymmetric",
                                path=rel_path,
                                line=idx,
                                source_origin="source",
                                confidence=0.98,
                                detection_method="config_parse",
                                evidence=line_str[:160]
                            ))
                        if "ssh-dss" in line_str:
                            results.append(CryptoAssetResult(
                                name="DSA",
                                type="key",
                                algorithm_class="asymmetric",
                                path=rel_path,
                                line=idx,
                                source_origin="source",
                                confidence=0.98,
                                detection_method="config_parse",
                                evidence=line_str[:160],
                                key_size=1024
                            ))

        return results
