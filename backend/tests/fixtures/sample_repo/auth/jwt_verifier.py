import jwt
from Crypto.PublicKey import RSA

def verify_legacy_token(token: str, public_key_pem: str):
    """Vulnerable verification using RSA-1024."""
    key = RSA.import_key(public_key_pem)
    return jwt.decode(token, key=public_key_pem, algorithms=["RS256"])

def generate_legacy_rsa_key():
    """Vulnerable key generation using RSA-1024."""
    return RSA.generate(1024)

def generate_standard_rsa_key():
    """Standard classical RSA-2048 (vulnerable to Shor's algorithm)."""
    return RSA.generate(2048)
