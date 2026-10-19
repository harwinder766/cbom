import os
import re
from pathlib import Path
from typing import List, Set
from backend.app.scanners.base import BaseScanner, CryptoAssetResult

BINARY_EXTENSIONS = {".elf", ".so", ".dll", ".exe", ".bin", ".dylib", ".jar"}

# Signature patterns inside binary strings
BINARY_SIGNATURES = [
    (r"\bEVP_aes_128_ecb\b", "AES-128", "algorithm", "symmetric", "ECB", 128),
    (r"\bEVP_aes_128_cbc\b", "AES-128", "algorithm", "symmetric", "CBC", 128),
    (r"\bEVP_aes_256_gcm\b", "AES-256", "algorithm", "symmetric", "GCM", 256),
    (r"\b(?:RSA_generate_key|RSA_new|EVP_PKEY_RSA)\b", "RSA-2048", "key", "asymmetric", None, 2048),
    (r"\b(?:ECDSA_do_sign|EC_KEY_new_by_curve_name)\b", "ECDSA P-256", "algorithm", "asymmetric", None, 256),
    (r"\b(?:DH_generate_key|DH_compute_key)\b", "Diffie-Hellman", "protocol", "asymmetric", None, 2048),
    (r"\b(?:EVP_md5|MD5_Init|MD5_Update)\b", "MD5", "algorithm", "hash", None, None),
    (r"\b(?:EVP_sha1|SHA1_Init|SHA1_Update)\b", "SHA-1", "algorithm", "hash", None, None),
    (r"\b(?:DES_ecb_encrypt|DES_ede3_cbc_encrypt)\b", "3DES", "algorithm", "symmetric", None, 112),
    (r"\b(?:RC4_set_key|RC4_encrypt)\b", "RC4", "algorithm", "symmetric", None, None),
    (r"\bOpenSSL\s+([0-9]+\.[0-9]+\.[0-9]+[a-z]?)\b", "OpenSSL", "library", "asymmetric", None, None),
    (r"\b(libsodium\s+1\.[0-9\.]+)\b", "libsodium", "library", "symmetric", None, None),
]

# Characteristic byte sequences (Hex strings)
AES_SBOX_PREFIX = bytes([0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5])

class BinaryScanner(BaseScanner):
    def scan(self, target_dir: Path) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []

        for root, dirs, files in os.walk(target_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ["node_modules", "vendor", "__pycache__", ".venv", "venv"]]

            for file_name in files:
                file_path = Path(root) / file_name
                ext = file_path.suffix.lower()

                if ext not in BINARY_EXTENSIONS:
                    continue

                rel_path = str(file_path.relative_to(target_dir)).replace("\\", "/")

                try:
                    with open(file_path, "rb") as f:
                        data = f.read(10 * 1024 * 1024) # Cap binary read at 10MB
                except Exception:
                    continue

                # 1. String & symbol pattern matching
                text = self._extract_ascii_strings(data)
                for pattern, name, asset_type, algo_class, mode, key_size in BINARY_SIGNATURES:
                    match = re.search(pattern, text)
                    if match:
                        matched_str = match.group(0)
                        if name == "OpenSSL":
                            ver = match.group(1) if match.groups() else ""
                            results.append(CryptoAssetResult(
                                name=f"OpenSSL {ver}".strip(),
                                type="library",
                                algorithm_class="asymmetric",
                                path=rel_path,
                                source_origin="binary",
                                confidence=0.98,
                                detection_method="binary_signature",
                                evidence=f"Extracted Symbol/Version: '{matched_str}'",
                                version=ver,
                                library="openssl"
                            ))
                        else:
                            results.append(CryptoAssetResult(
                                name=name,
                                type=asset_type,
                                algorithm_class=algo_class,
                                path=rel_path,
                                source_origin="binary",
                                confidence=0.92,
                                detection_method="binary_signature",
                                evidence=f"Symbol Table Match: '{matched_str}'",
                                mode=mode,
                                key_size=key_size
                            ))

                # 2. Constant inspection (e.g. AES S-box in binary rodata)
                if AES_SBOX_PREFIX in data:
                    results.append(CryptoAssetResult(
                        name="AES (S-box constant detected)",
                        type="algorithm",
                        algorithm_class="symmetric",
                        path=rel_path,
                        source_origin="binary",
                        confidence=0.95,
                        detection_method="binary_signature",
                        evidence="Raw constant lookup table: AES substitution box header matched in binary payload",
                        key_size=128
                    ))

        return self._deduplicate(results)

    def _extract_ascii_strings(self, data: bytes, min_len: int = 4) -> str:
        """Extracts printable ASCII strings from binary data safely."""
        pattern = re.compile(rb"[\x20-\x7E]{" + str(min_len).encode() + rb",}")
        found = pattern.findall(data)
        return "\n".join(s.decode("ascii", errors="ignore") for s in found)

    def _deduplicate(self, results: List[CryptoAssetResult]) -> List[CryptoAssetResult]:
        seen = set()
        deduped = []
        for r in results:
            key = (r.name, r.path)
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        return deduped
