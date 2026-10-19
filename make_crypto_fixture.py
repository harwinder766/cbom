"""
Generate a local test project full of cryptographic artefacts for ECDAT/CBOM scanning.

Everything here is DELIBERATELY INSECURE and for testing only. Keys are freshly
generated throwaway keys; never reuse them.

Usage (from repo root, using the backend venv so `cryptography` is available):
    backend\\.venv\\Scripts\\python make_crypto_fixture.py
    backend\\.venv\\Scripts\\python make_crypto_fixture.py C:\\path\\to\\output_dir
"""
import datetime
import sys
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.x509.oid import NameOID

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "backend/tests/fixtures/generated_crypto_repo")


def write(rel: str, text: str) -> None:
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text.lstrip("\n"), encoding="utf-8")


def make_cert(key, name: str, days: int, sig_hash=None):
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, name),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "ECDAT Test Org"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    return (
        x509.CertificateBuilder()
        .subject_name(subject).issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=days))
        .sign(key, sig_hash or hashes.SHA256())
    )


def pem_cert(cert) -> str:
    return cert.public_bytes(serialization.Encoding.PEM).decode()


def pem_key(key) -> str:
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ).decode()


# ---------------------------------------------------------------- source code
write("src/auth.py", '''
import hashlib
import hmac
from Crypto.Cipher import AES, DES3, ARC4
from Crypto.PublicKey import RSA
from cryptography.hazmat.primitives.asymmetric import rsa, ec, dsa, dh
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

def gen_weak_rsa():
    return rsa.generate_private_key(public_exponent=65537, key_size=1024)

def gen_rsa():
    return RSA.generate(2048)

def gen_rsa_4096():
    return rsa.generate_private_key(public_exponent=65537, key_size=4096)

def sign_ecdsa():
    return ec.generate_private_key(ec.SECP256R1())

def dsa_key():
    return dsa.generate_private_key(key_size=2048)

def dh_params():
    return dh.generate_parameters(generator=2, key_size=2048)

def encrypt_ecb(key, data):
    return AES.new(key, AES.MODE_ECB).encrypt(data)

def encrypt_cbc(key, iv, data):
    return AES.new(key, AES.MODE_CBC, iv).encrypt(data)

def encrypt_gcm_256(key, nonce, data):
    return Cipher(algorithms.AES(key), modes.GCM(nonce))  # AES-256-GCM

def legacy_3des(key, iv):
    return DES3.new(key, DES3.MODE_CBC, iv)

def legacy_rc4(key):
    return ARC4.new(key)

def checksum_md5(data):
    return hashlib.md5(data).hexdigest()

def checksum_sha1(data):
    return hashlib.sha1(data).hexdigest()

def digest_sha256(data):
    return hashlib.sha256(data).hexdigest()

def digest_sha3(data):
    return hashlib.sha3_512(data).hexdigest()

def mac(key, msg):
    return hmac.new(key, msg, hashlib.sha256).hexdigest()

def kdf(password, salt):
    return hashlib.pbkdf2_hmac("sha1", password, salt, 1000)
''')

write("src/server.js", '''
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");
const token = jwt.sign({ user: 1 }, "secret", { algorithm: "RS256" });
const ec = jwt.sign({ user: 1 }, "secret", { algorithm: "ES256" });
const enc = crypto.createCipheriv("aes-128-ecb", key, null);
const des = CryptoJS.DES.encrypt("data", "key");
const rc4 = CryptoJS.RC4.encrypt("data", "key");
crypto.generateKeyPairSync("rsa", { modulusLength: 1024 });
crypto.createECDH("secp256k1");
const https = require("https");
const opts = { minVersion: "TLSv1", secureProtocol: "TLSv1_method" };
''')

write("src/Main.java", '''
import javax.crypto.Cipher;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;

public class Main {
    void run() throws Exception {
        Cipher des = Cipher.getInstance("DES/ECB/PKCS5Padding");
        Cipher aes = Cipher.getInstance("AES/CBC/PKCS5Padding");
        Cipher gcm = Cipher.getInstance("AES/GCM/NoPadding");
        MessageDigest md5 = MessageDigest.getInstance("MD5");
        MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
        KeyPairGenerator rsa = KeyPairGenerator.getInstance("RSA");
        rsa.initialize(1024);
        KeyPairGenerator ec = KeyPairGenerator.getInstance("EC");
        Signature sig = Signature.getInstance("SHA1withRSA");
        Signature dsa = Signature.getInstance("SHA256withDSA");
    }
}
''')

write("src/main.go", '''
package main

import (
	"crypto/md5"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rc4"
	"crypto/des"
	"crypto/tls"
)

func main() {
	rsa.GenerateKey(rand.Reader, 1024)
	ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	md5.New()
	sha1.New()
	rc4.NewCipher(nil)
	des.NewTripleDESCipher(nil)
	_ = &tls.Config{MinVersion: tls.VersionTLS10}
}
''')

write("src/crypto_util.cpp", '''
#include <openssl/evp.h>
#include <openssl/rsa.h>
#include <openssl/sha.h>
#include <openssl/md5.h>

void legacy() {
    unsigned char out[20];
    SHA1((const unsigned char*)"x", 1, out);
    MD5((const unsigned char*)"x", 1, out);
    EVP_aes_128_ecb();
    EVP_des_ede3_cbc();
    RSA* r = RSA_generate_key(1024, 65537, NULL, NULL);
}
''')

# ---------------------------------------------------------------- dependencies
write("requirements.txt", "pycryptodome==3.10.1\ncryptography==2.9\npyOpenSSL==17.5.0\nPyJWT==1.7.1\npassлib==1.7.4\n".replace("passлib", "passlib"))
write("package.json", '''{
  "name": "ecdat-fixture",
  "version": "1.0.0",
  "dependencies": {
    "crypto-js": "3.1.9",
    "jsonwebtoken": "8.5.1",
    "node-forge": "0.9.0",
    "bcrypt": "3.0.0"
  }
}
''')
write("pom.xml", '''<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>test</groupId><artifactId>ecdat-fixture</artifactId><version>1.0</version>
  <dependencies>
    <dependency><groupId>org.bouncycastle</groupId><artifactId>bcprov-jdk15on</artifactId><version>1.60</version></dependency>
    <dependency><groupId>commons-codec</groupId><artifactId>commons-codec</artifactId><version>1.10</version></dependency>
  </dependencies>
</project>
''')
write("go.mod", "module example.com/fixture\n\ngo 1.16\n\nrequire (\n\tgolang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2\n\tgithub.com/dgrijalva/jwt-go v3.2.0+incompatible\n)\n")

# ---------------------------------------------------------------- certs and keys
rsa1024 = rsa.generate_private_key(65537, 1024)
rsa2048 = rsa.generate_private_key(65537, 2048)
rsa4096 = rsa.generate_private_key(65537, 4096)
ec256 = ec.generate_private_key(ec.SECP256R1())
ec384 = ec.generate_private_key(ec.SECP384R1())

write("certs/weak_rsa1024.crt", pem_cert(make_cert(rsa1024, "weak.example.com", 365)))
write("certs/server_rsa2048.crt", pem_cert(make_cert(rsa2048, "server.example.com", 825)))
write("certs/root_ca_rsa4096.crt", pem_cert(make_cert(rsa4096, "Root CA", 3650)))
write("certs/api_ecdsa_p256.crt", pem_cert(make_cert(ec256, "api.example.com", 365)))
write("certs/internal_ecdsa_p384.crt", pem_cert(make_cert(ec384, "internal.example.com", 365)))
try:
    write("certs/legacy_sha1_sig.crt", pem_cert(make_cert(rsa2048, "legacy.example.com", 365, hashes.SHA1())))
except Exception as exc:  # some cryptography builds refuse SHA-1 signatures
    print(f"skipped SHA-1 signed cert: {exc}")
# expired cert
now = datetime.datetime.now(datetime.timezone.utc)
expired = (
    x509.CertificateBuilder()
    .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "expired.example.com")]))
    .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "expired.example.com")]))
    .public_key(rsa2048.public_key()).serial_number(x509.random_serial_number())
    .not_valid_before(now - datetime.timedelta(days=800))
    .not_valid_after(now - datetime.timedelta(days=30))
    .sign(rsa2048, hashes.SHA256())
)
write("certs/expired.crt", pem_cert(expired))

# committed private keys (should be flagged as secret exposure)
write("secrets/leaked_rsa.key", pem_key(rsa2048))
write("secrets/leaked_ec.key", pem_key(ec256))

# ---------------------------------------------------------------- configs
write("config/nginx.conf", '''
server {
    listen 443 ssl;
    server_name example.com;
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers "RC4-SHA:DES-CBC3-SHA:AES128-SHA:ECDHE-RSA-AES256-GCM-SHA384";
    ssl_prefer_server_ciphers on;
    ssl_certificate     /etc/ssl/server_rsa2048.crt;
    ssl_certificate_key /etc/ssl/server.key;
}
''')
write("config/sshd_config", '''
Port 22
Protocol 2
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_dsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
Ciphers 3des-cbc,aes128-cbc,aes256-ctr
MACs hmac-md5,hmac-sha1,hmac-sha2-256
KexAlgorithms diffie-hellman-group1-sha1,diffie-hellman-group14-sha1,curve25519-sha256
PermitRootLogin yes
''')
write("config/openssl.cnf", '''
[ req ]
default_bits       = 1024
default_md         = sha1
distinguished_name = req_distinguished_name
[ req_distinguished_name ]
''')
write("config/java.security", '''
jdk.tls.disabledAlgorithms=SSLv3, MD5withRSA
jdk.certpath.disabledAlgorithms=MD2
security.provider.1=sun.security.provider.Sun
''')
write("infra/ingress_tls.yaml", '''
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
  annotations:
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1 TLSv1.1 TLSv1.2"
    nginx.ingress.kubernetes.io/ssl-ciphers: "DHE-RSA-AES128-SHA:ECDHE-ECDSA-AES256-GCM-SHA384"
''')

# ---------------------------------------------------------------- synthetic binary
# Not a real executable: ELF magic + crypto strings + the AES S-box and SHA-256 init
# constants, purely to exercise the binary scanner's signature matching.
aes_sbox_start = bytes([0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76])
sha256_init = bytes.fromhex("6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19")
blob = (
    b"\x7fELF\x02\x01\x01" + b"\x00" * 57
    + b"OpenSSL 1.0.1f 6 Jan 2014\x00EVP_EncryptInit_ex\x00RSA_generate_key_ex\x00"
    + b"SHA1_Init\x00MD5_Update\x00EC_KEY_new_by_curve_name\x00DES_ecb_encrypt\x00"
    + aes_sbox_start + b"\x00" * 16 + sha256_init
)
(OUT / "bin").mkdir(parents=True, exist_ok=True)
(OUT / "bin" / "legacy_crypto_tool.so").write_bytes(blob)

count = sum(1 for p in OUT.rglob("*") if p.is_file())
print(f"Generated {count} files in {OUT.resolve()}")
print("Scan it in the UI with source_type=local and this path (must be inside the allowlisted root).")
