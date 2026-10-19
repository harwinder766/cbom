package services

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
)

// GenerateECDSAKey creates an ECDSA P-256 key pair (Shor vulnerable)
func GenerateECDSAKey() (*ecdsa.PrivateKey, error) {
	pubkeyCurve := elliptic.P256()
	return ecdsa.GenerateKey(pubkeyCurve, rand.Reader)
}

func SignTransaction(privKey *ecdsa.PrivateKey, payload []byte) ([]byte, error) {
	hash := sha256.Sum256(payload)
	r, s, err := ecdsa.Sign(rand.Reader, privKey, hash[:])
	if err != nil {
		return nil, err
	}
	return append(r.Bytes(), s.Bytes()...), nil
}
