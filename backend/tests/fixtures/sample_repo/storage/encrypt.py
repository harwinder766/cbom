from Crypto.Cipher import AES

KEY_128 = b"16byteSecretKey!"

def insecure_encrypt_ecb(plaintext: bytes) -> bytes:
    """Uses AES-128 in ECB mode (insecure, preserves data patterns)."""
    cipher = AES.new(KEY_128, AES.MODE_ECB)
    # Pad to 16 bytes
    padded = plaintext + b" " * (16 - len(plaintext) % 16)
    return cipher.encrypt(padded)

def secure_encrypt_gcm(plaintext: bytes, key_256: bytes) -> tuple:
    """Uses quantum-safe AES-256 in GCM mode."""
    cipher = AES.new(key_256, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return cipher.nonce, ciphertext, tag
