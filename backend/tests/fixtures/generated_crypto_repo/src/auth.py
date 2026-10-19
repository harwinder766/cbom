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
