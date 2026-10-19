from Crypto.Cipher import DES3

# 3DES key
TRIPLE_DES_KEY = b"24byteSecretTripleDESKey"

def encrypt_payment_payload(payload: bytes) -> bytes:
    """Uses deprecated 3DES (Triple DES)."""
    cipher = DES3.new(TRIPLE_DES_KEY, DES3.MODE_CBC, iv=b"12345678")
    padded = payload + b"\0" * (8 - len(payload) % 8)
    return cipher.encrypt(padded)
