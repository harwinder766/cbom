import os
import re
import ast
from pathlib import Path
from typing import List, Optional
from backend.app.scanners.base import BaseScanner, CryptoAssetResult
from backend.app.services.knowledge_base import kb

# File extensions by language
SOURCE_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "javascript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".c": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
}

# Regex pattern catalogue: (pattern, algo_name, algo_type, algo_class, mode, key_size, confidence)
REGEX_PATTERNS = [
    # RSA
    (r"\b(?:RSA[._-]?(?:generate(?:_key|_private_key)?|new|KeyPairGenerator)|generate_private_key)\b.*?(1024|2048|3072|4096)?", "RSA", "key", "asymmetric", None, None, 0.95),
    (r"\b(?:RSAPrivateKey|RSAPublicKey|RSASSA|RSA-OAEP|RSA-PSS|PKCS1)\b", "RSA", "algorithm", "asymmetric", None, None, 0.90),
    (r"['\"]RS(256|384|512)['\"]", "RSA", "algorithm", "asymmetric", None, 2048, 0.92),
    (r"\bRSA_generate_key\b", "RSA", "key", "asymmetric", None, None, 0.95),

    # ECDSA & Curves
    (r"\bECDSA[._-]?(?:generate(?:_key)?|new|sign|verify)?\b", "ECDSA", "algorithm", "asymmetric", None, 256, 0.92),
    (r"['\"]ES(256|384|512)['\"]", "ECDSA", "algorithm", "asymmetric", None, 256, 0.92),
    (r"\b(?:P-256|P-384|P-521|secp256k1|secp256r1|prime256v1)\b", "ECDSA P-256", "algorithm", "asymmetric", None, 256, 0.94),
    (r"\b(?:Ed25519|Ed448|Curve25519)\b", "Ed25519", "key", "asymmetric", None, 256, 0.94),
    (r"\b(?:X25519|X448)\b", "X25519", "protocol", "asymmetric", None, 256, 0.92),

    # Diffie-Hellman
    (r"\b(?:Diffie-Hellman|DiffieHellman|DHParameterSpec|DH_generate_key|FFDHE)\b", "Diffie-Hellman", "protocol", "asymmetric", None, 2048, 0.92),
    (r"\bECDH[._-]?(?:compute_key|derive|new)?\b", "ECDH", "protocol", "asymmetric", None, 256, 0.92),

    # DSA
    (r"\b(?:DSA|DSAPrivateKey|DSAPublicKey|DSA_generate_key)\b", "DSA", "key", "asymmetric", None, 1024, 0.90),

    # AES Modes
    (r"\bAES(?:_CIPHER)?\b.*?(?:MODE_ECB|\.ECB\b|/ECB/|['\"](?:aes-128-ecb|aes-256-ecb)['\"])", "AES-128", "algorithm", "symmetric", "ECB", 128, 0.98),
    (r"\bAES(?:_CIPHER)?\b.*?(?:MODE_CBC|\.CBC\b|/CBC/|['\"](?:aes-128-cbc)['\"])", "AES-128", "algorithm", "symmetric", "CBC", 128, 0.95),
    (r"\bAES(?:_CIPHER)?\b.*?(?:MODE_GCM|\.GCM\b|/GCM/|['\"](?:aes-128-gcm)['\"])", "AES-128", "algorithm", "symmetric", "GCM", 128, 0.95),
    (r"\bAES(?:_CIPHER)?\b.*?(?:MODE_CBC|\.CBC\b|/CBC/|['\"](?:aes-256-cbc)['\"])", "AES-256", "algorithm", "symmetric", "CBC", 256, 0.95),
    (r"\bAES(?:_CIPHER)?\b.*?(?:MODE_GCM|\.GCM\b|/GCM/|['\"](?:aes-256-gcm)['\"])", "AES-256", "algorithm", "symmetric", "GCM", 256, 0.98),
    (r"\b(?:AES_128_GCM|AES_256_GCM|AES-128|AES-256)\b", "AES-256", "algorithm", "symmetric", None, 256, 0.88),

    # Classically Broken Symmetrics: 3DES, DES, RC4
    (r"\b(?:DES3|TripleDES|DES-EDE3|TDES|3DES)\b", "3DES", "algorithm", "symmetric", None, 112, 0.95),
    (r"\b(?:DES_new|DES_cblock|SingleDES|DES/CBC|DES/ECB)\b", "DES", "algorithm", "symmetric", None, 56, 0.95),
    (r"\b(?:RC4|Arcfour|ARC4)\b", "RC4", "algorithm", "symmetric", None, None, 0.95),

    # Hashes: MD5, SHA-1, SHA-2, SHA-3
    (r"\b(?:md5|MD5|MD5_Init|MessageDigest\.getInstance\([\"']MD5[\"']\))\b", "MD5", "algorithm", "hash", None, None, 0.95),
    (r"\b(?:sha1|SHA1|SHA-1|SHA1_Init|MessageDigest\.getInstance\([\"']SHA-1[\"']\))\b", "SHA-1", "algorithm", "hash", None, None, 0.95),
    (r"\b(?:sha256|SHA256|SHA-256)\b", "SHA-256", "algorithm", "hash", None, None, 0.90),
    (r"\b(?:sha384|SHA384|SHA-384)\b", "SHA-384", "algorithm", "hash", None, None, 0.92),
    (r"\b(?:sha512|SHA512|SHA-512)\b", "SHA-512", "algorithm", "hash", None, None, 0.92),
    (r"\b(?:sha3|SHA3|SHA3-256|SHA3-512)\b", "SHA-512", "algorithm", "hash", None, None, 0.92),

    # Modern Password Hashing & KDFs
    (r"\b(?:bcrypt|scrypt|argon2|Argon2id|pbkdf2|PBKDF2)\b", "Argon2", "algorithm", "symmetric", None, None, 0.90),
    (r"\b(?:HMAC|HMAC_Init|HmacSHA256)\b", "HMAC", "algorithm", "symmetric", None, None, 0.90),

    # ChaCha20
    (r"\b(?:ChaCha20|ChaCha20Poly1305|CHACHA20_POLY1305)\b", "ChaCha20-Poly1305", "algorithm", "symmetric", None, 256, 0.95),
]

class SourceScanner(BaseScanner):
    def scan(self, target_dir: Path) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []

        for root, dirs, files in os.walk(target_dir):
            # Exclude vendor and hidden directories
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ["node_modules", "vendor", "__pycache__", ".venv", "venv"]]

            for file_name in files:
                file_path = Path(root) / file_name
                ext = file_path.suffix.lower()

                if ext not in SOURCE_EXTENSIONS:
                    continue

                rel_path = str(file_path.relative_to(target_dir)).replace("\\", "/")

                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except Exception:
                    continue

                # Run Python AST scanner for .py files
                if ext == ".py":
                    ast_results = self._scan_python_ast(content, rel_path)
                    results.extend(ast_results)

                # Run Regex scanner for all supported source files
                regex_results = self._scan_regex(content, rel_path)
                results.extend(regex_results)

        return self._deduplicate(results)

    def _scan_python_ast(self, content: str, rel_path: str) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []
        try:
            tree = ast.parse(content)
        except SyntaxError:
            return results

        for node in ast.walk(tree):
            # Check function calls
            if isinstance(node, ast.Call):
                func_name = ""
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr

                line_num = getattr(node, "lineno", 1)

                # Detection: jwt.decode / jwt.encode
                if func_name in ["decode", "encode"]:
                    for kw in node.keywords:
                        if kw.arg == "algorithms" and isinstance(kw.value, ast.List):
                            for elt in kw.value.elts:
                                if isinstance(elt, ast.Constant) and elt.value == "RS256":
                                    results.append(CryptoAssetResult(
                                        name="RSA-2048",
                                        type="key",
                                        algorithm_class="asymmetric",
                                        path=rel_path,
                                        line=line_num,
                                        source_origin="source",
                                        confidence=0.98,
                                        detection_method="ast",
                                        evidence="jwt.decode(..., algorithms=['RS256'])",
                                        key_size=2048,
                                        library="PyJWT",
                                        oid="1.2.840.113549.1.1.1"
                                    ))
                                elif isinstance(elt, ast.Constant) and elt.value == "ES256":
                                    results.append(CryptoAssetResult(
                                        name="ECDSA P-256",
                                        type="algorithm",
                                        algorithm_class="asymmetric",
                                        path=rel_path,
                                        line=line_num,
                                        source_origin="source",
                                        confidence=0.95,
                                        detection_method="ast",
                                        evidence="jwt.decode(..., algorithms=['ES256'])",
                                        key_size=256,
                                        library="PyJWT",
                                        oid="1.2.840.10045.2.1"
                                    ))

                # Detection: hashlib.md5 / sha1
                if func_name == "md5":
                    results.append(CryptoAssetResult(
                        name="MD5",
                        type="algorithm",
                        algorithm_class="hash",
                        path=rel_path,
                        line=line_num,
                        source_origin="source",
                        confidence=0.99,
                        detection_method="ast",
                        evidence="hashlib.md5()",
                        oid="1.2.840.113549.2.5"
                    ))
                elif func_name == "sha1":
                    results.append(CryptoAssetResult(
                        name="SHA-1",
                        type="algorithm",
                        algorithm_class="hash",
                        path=rel_path,
                        line=line_num,
                        source_origin="source",
                        confidence=0.99,
                        detection_method="ast",
                        evidence="hashlib.sha1()",
                        oid="1.3.14.3.2.26"
                    ))

                # Detection: AES.new(..., AES.MODE_ECB)
                if func_name == "new":
                    for arg in node.args:
                        if isinstance(arg, ast.Attribute) and arg.attr == "MODE_ECB":
                            results.append(CryptoAssetResult(
                                name="AES-128",
                                type="algorithm",
                                algorithm_class="symmetric",
                                path=rel_path,
                                line=line_num,
                                source_origin="source",
                                confidence=0.99,
                                detection_method="ast",
                                evidence="AES.new(..., AES.MODE_ECB)",
                                mode="ECB",
                                key_size=128
                            ))
                        elif isinstance(arg, ast.Attribute) and arg.attr == "MODE_CBC":
                            results.append(CryptoAssetResult(
                                name="AES-128",
                                type="algorithm",
                                algorithm_class="symmetric",
                                path=rel_path,
                                line=line_num,
                                source_origin="source",
                                confidence=0.95,
                                detection_method="ast",
                                evidence="AES.new(..., AES.MODE_CBC)",
                                mode="CBC",
                                key_size=128
                            ))

                # Detection: rsa.generate_private_key(...)
                if func_name == "generate_private_key":
                    key_size = 2048
                    for kw in node.keywords:
                        if kw.arg in ["key_size", "bits"] and isinstance(kw.value, ast.Constant):
                            key_size = kw.value.value
                    results.append(CryptoAssetResult(
                        name=f"RSA-{key_size}",
                        type="key",
                        algorithm_class="asymmetric",
                        path=rel_path,
                        line=line_num,
                        source_origin="source",
                        confidence=0.98,
                        detection_method="ast",
                        evidence=f"rsa.generate_private_key(key_size={key_size})",
                        key_size=key_size,
                        oid="1.2.840.113549.1.1.1"
                    ))

        return results

    def _scan_regex(self, content: str, rel_path: str) -> List[CryptoAssetResult]:
        results: List[CryptoAssetResult] = []
        lines = content.splitlines()

        for idx, line in enumerate(lines, start=1):
            if len(line.strip()) == 0 or line.strip().startswith("//") or line.strip().startswith("#"):
                continue

            for pattern, name, asset_type, algo_class, mode, default_key_size, confidence in REGEX_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    key_size = default_key_size
                    # Check if match captured explicit key size (e.g. 1024/2048)
                    for g in match.groups():
                        if g and g.isdigit():
                            key_size = int(g)

                    evidence = line.strip()[:160]

                    # Resolve KB metadata
                    entry = kb.lookup_algorithm(name)
                    oid = entry.get("oid") if entry else None

                    results.append(CryptoAssetResult(
                        name=f"{name}-{key_size}" if (name in ["RSA", "DH", "DSA"] and key_size) else name,
                        type=asset_type,
                        algorithm_class=algo_class,
                        path=rel_path,
                        line=idx,
                        source_origin="source",
                        confidence=confidence,
                        detection_method="regex_pattern",
                        evidence=evidence,
                        key_size=key_size,
                        mode=mode,
                        oid=oid
                    ))

        return results

    def _deduplicate(self, results: List[CryptoAssetResult]) -> List[CryptoAssetResult]:
        seen = set()
        deduped = []
        for r in results:
            key = (r.name, r.path, r.line)
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        return deduped
