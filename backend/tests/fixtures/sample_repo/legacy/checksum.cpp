#include <iostream>
#include <string>
#include <openssl/md5.h>
#include <openssl/sha.h>

std::string compute_legacy_md5(const std::string& input) {
    unsigned char digest[MD5_DIGEST_LENGTH];
    MD5_CTX ctx;
    MD5_Init(&ctx);
    MD5_Update(&ctx, input.c_str(), input.length());
    MD5_Final(digest, &ctx);
    return std::string((char*)digest, MD5_DIGEST_LENGTH);
}

std::string compute_legacy_sha1(const std::string& input) {
    unsigned char digest[SHA_DIGEST_LENGTH];
    SHA_CTX ctx;
    SHA1_Init(&ctx);
    SHA1_Update(&ctx, input.c_str(), input.length());
    SHA1_Final(digest, &ctx);
    return std::string((char*)digest, SHA_DIGEST_LENGTH);
}
