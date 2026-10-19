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
