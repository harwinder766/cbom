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
