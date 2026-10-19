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
