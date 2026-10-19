import io
import json
import tarfile
import zipfile
import tempfile
from pathlib import Path

from backend.app.scanners.source_scanner import SourceScanner
from backend.app.scanners.dependency_scanner import DependencyScanner
from backend.app.scanners.cert_key_scanner import CertKeyScanner
from backend.app.scanners.config_scanner import ConfigScanner
from backend.app.scanners.binary_scanner import BinaryScanner, AES_SBOX_PREFIX
from backend.app.scanners.container_scanner import ContainerScanner

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "sample_repo"

def test_source_scanner():
    scanner = SourceScanner()
    results = scanner.scan(FIXTURES_DIR)

    names = [r.name for r in results]

    # Verify RSA, ECDSA, AES, MD5, SHA-1, 3DES detected
    assert any("RSA" in n for n in names), f"Expected RSA in {names}"
    assert any("ECDSA" in n for n in names), f"Expected ECDSA in {names}"
    assert any("AES" in n for n in names), f"Expected AES in {names}"
    assert any("MD5" in n for n in names), f"Expected MD5 in {names}"
    assert any("SHA-1" in n for n in names), f"Expected SHA-1 in {names}"
    assert any("3DES" in n or "DES" in n for n in names), f"Expected 3DES in {names}"

def test_dependency_scanner():
    scanner = DependencyScanner()
    results = scanner.scan(FIXTURES_DIR)

    names = [r.name for r in results]
    assert any("pycryptodome" in n.lower() for n in names), f"Expected pycryptodome in {names}"
    assert any("crypto-js" in n.lower() for n in names), f"Expected crypto-js in {names}"

def test_cert_key_scanner():
    scanner = CertKeyScanner()
    results = scanner.scan(FIXTURES_DIR)

    types = [r.type for r in results]
    names = [r.name for r in results]

    # Must detect both the exposed private key and the certificate
    assert "key" in types, "Committed private key should be detected"
    assert "certificate" in types, "X.509 Certificate should be detected"
    assert any("RSA" in n for n in names), f"Expected RSA cert in {names}"

def test_config_scanner():
    scanner = ConfigScanner()
    results = scanner.scan(FIXTURES_DIR)

    names = [r.name for r in results]
    assert "TLS 1.0" in names, f"Expected TLS 1.0 in {names}"
    assert any("RC4" in n for n in names), f"Expected RC4 in {names}"

def test_binary_scanner_elf_and_jar():
    """Validates BinaryScanner against a crafted ELF binary and a JAR fixture."""
    scanner = BinaryScanner()

    with tempfile.TemporaryDirectory(prefix="test_binary_") as tmp_dir:
        tmp_path = Path(tmp_dir)

        # 1. Create a tiny mock ELF binary with embedded OpenSSL symbols and AES S-box table
        elf_path = tmp_path / "micro_service.elf"
        elf_header = b"\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00"
        symbol_payload = (
            b"Some application binary rodata\x00"
            b"EVP_aes_128_ecb\x00"
            b"RSA_generate_key\x00"
            b"OpenSSL 3.0.2\x00"
        )
        elf_data = elf_header + symbol_payload + AES_SBOX_PREFIX + b"\x00" * 32
        elf_path.write_bytes(elf_data)

        # 2. Create a small mock JAR file with SHA-1 routine signature
        jar_path = tmp_path / "legacy-crypto.jar"
        jar_buffer = io.BytesIO()
        with zipfile.ZipFile(jar_buffer, "w") as zf:
            zf.writestr(
                "org/bouncycastle/CryptoService.class",
                b"\xca\xfe\xba\xbe\x00\x03\x00\x2d" + b"EVP_sha1\x00" + b"\x00" * 20
            )
        jar_path.write_bytes(jar_buffer.getvalue())

        results = scanner.scan(tmp_path)
        names = [r.name for r in results]
        paths = [r.path for r in results]

        # Verify ELF detections
        assert any("AES-128" in n for n in names), f"Expected AES-128 in {names}"
        assert any("RSA-2048" in n for n in names), f"Expected RSA-2048 in {names}"
        assert any("OpenSSL 3.0.2" in n for n in names), f"Expected OpenSSL 3.0.2 in {names}"
        assert any("S-box" in n for n in names), f"Expected AES S-box in {names}"
        assert any("micro_service.elf" in p for p in paths), f"Expected ELF path in {paths}"

        # Verify JAR detections
        assert any("SHA-1" in n for n in names), f"Expected SHA-1 in {names}"
        assert any("legacy-crypto.jar" in p for p in paths), f"Expected JAR path in {paths}"

def test_container_scanner_docker_archive():
    """Validates ContainerScanner against a tiny docker-save tarball built in the test."""
    scanner = ContainerScanner()

    with tempfile.TemporaryDirectory(prefix="test_container_") as tmp_dir:
        tmp_path = Path(tmp_dir)

        # 1. Build an inner layer.tar containing cryptographic source code and a certificate
        layer_buffer = io.BytesIO()
        with tarfile.open(fileobj=layer_buffer, mode="w") as layer_tar:
            # Source file with RSA and AES
            py_code = (
                b"from cryptography.hazmat.primitives.asymmetric import rsa\n"
                b"from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes\n"
                b"key = rsa.generate_private_key(public_exponent=65537, key_size=1024)\n"
                b"cipher = Cipher(algorithms.AES(b'0'*16), modes.ECB())\n"
            )
            ti_code = tarfile.TarInfo(name="app/crypto_service.py")
            ti_code.size = len(py_code)
            layer_tar.addfile(ti_code, io.BytesIO(py_code))

            # Config file with TLS 1.0
            nginx_conf = b"server { ssl_protocols TLSv1.0; ssl_ciphers RC4-SHA; }\n"
            ti_conf = tarfile.TarInfo(name="etc/nginx/ssl.conf")
            ti_conf.size = len(nginx_conf)
            layer_tar.addfile(ti_conf, io.BytesIO(nginx_conf))

        layer_bytes = layer_buffer.getvalue()

        # 2. Build root docker-save image tar
        image_tar_path = tmp_path / "microservice-image.tar"
        with tarfile.open(image_tar_path, "w") as root_tar:
            manifest_json = json.dumps([
                {
                    "Config": "config.json",
                    "RepoTags": ["ecdat/sample:latest"],
                    "Layers": ["layer1/layer.tar"]
                }
            ]).encode("utf-8")
            ti_manifest = tarfile.TarInfo(name="manifest.json")
            ti_manifest.size = len(manifest_json)
            root_tar.addfile(ti_manifest, io.BytesIO(manifest_json))

            config_json = b"{}"
            ti_cfg = tarfile.TarInfo(name="config.json")
            ti_cfg.size = len(config_json)
            root_tar.addfile(ti_cfg, io.BytesIO(config_json))

            ti_layer = tarfile.TarInfo(name="layer1/layer.tar")
            ti_layer.size = len(layer_bytes)
            root_tar.addfile(ti_layer, io.BytesIO(layer_bytes))

        # 3. Execute container scanner
        results = scanner.scan(tmp_path)

        assert len(results) > 0, "Container scanner should detect cryptographic assets inside layers"
        names = [r.name for r in results]
        origins = [r.source_origin for r in results]
        paths = [r.path for r in results]

        assert all(o == "container" for o in origins), "All findings must have source_origin='container'"
        assert any("RSA" in n for n in names), f"Expected RSA in {names}"
        assert any("TLS 1.0" in n for n in names), f"Expected TLS 1.0 in {names}"
        assert any("container://microservice-image.tar" in p for p in paths), f"Expected container:// URI in {paths}"
