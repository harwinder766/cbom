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
