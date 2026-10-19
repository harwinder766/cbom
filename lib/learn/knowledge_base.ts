/**
 * Pure TypeScript mirror of backend/app/services/knowledge_base.py
 * and backend/data/algorithms.json & backend/data/pqc_recommendations.json.
 *
 * MIRRORS: backend/app/services/knowledge_base.py
 * Contains full client-side crypto classification table and migration rules.
 */

export interface AlgorithmMetadata {
  name: string;
  aliases: string[];
  algorithmClass: 'asymmetric' | 'symmetric' | 'hash' | 'protocol';
  type: string;
  quantumStatus: 'classically_broken' | 'shor_vulnerable' | 'grover_weakened' | 'quantum_safe';
  classicalSecurityBits: number;
  nistStatus: string;
  oid?: string;
  description: string;
  recommendedReplacement?: string;
  replacementRationale?: string;
}

export const KNOWN_ALGORITHMS: AlgorithmMetadata[] = [
  // 1. Asymmetric / Shor-Vulnerable
  {
    name: 'RSA',
    aliases: ['RSA-1024', 'RSA-2048', 'RSA-3072', 'RSA-4096', 'PKCS1', 'RSASSA-PKCS1-v1_5', 'RSA-OAEP', 'RSA-PSS'],
    algorithmClass: 'asymmetric',
    type: 'key',
    quantumStatus: 'shor_vulnerable',
    classicalSecurityBits: 112,
    nistStatus: 'deprecated_or_transition',
    oid: '1.2.840.113549.1.1.1',
    description: "Integer factorization cryptography; completely solvable in polynomial time via Shor's Algorithm.",
    recommendedReplacement: 'ML-DSA-65 (FIPS 204) / ML-KEM-768 (FIPS 203)',
    replacementRationale: 'Primary NIST standardized module-lattice standards for signatures and key encapsulation.',
  },
  {
    name: 'ECDSA',
    aliases: ['ECDSA-P256', 'ECDSA P-256', 'ECDSA-P384', 'secp256k1', 'secp256r1', 'prime256v1'],
    algorithmClass: 'asymmetric',
    type: 'algorithm',
    quantumStatus: 'shor_vulnerable',
    classicalSecurityBits: 128,
    nistStatus: 'fips_186_4_transition',
    oid: '1.2.840.10045.2.1',
    description: "Elliptic curve digital signatures; discrete logarithm solved in polynomial time by Shor's Algorithm.",
    recommendedReplacement: 'ML-DSA-44 / ML-DSA-65 (FIPS 204)',
    replacementRationale: 'Lattice-based digital signatures with minimal latency overhead.',
  },
  {
    name: 'Diffie-Hellman',
    aliases: ['DH', 'DH-1024', 'DH-2048', 'DHE', 'FFDHE'],
    algorithmClass: 'asymmetric',
    type: 'protocol',
    quantumStatus: 'shor_vulnerable',
    classicalSecurityBits: 112,
    nistStatus: 'transition',
    oid: '1.2.840.113549.1.3.1',
    description: "Finite-field key agreement; discrete logarithm broken by Shor's Algorithm (enables retrospective decryption).",
    recommendedReplacement: 'ML-KEM-768 (FIPS 203)',
    replacementRationale: 'NIST Level 3 post-quantum key encapsulation mechanism.',
  },
  {
    name: 'ECDH',
    aliases: ['ECDH-P256', 'ECDH-P384', 'ECDHE', 'ECDHE-RSA', 'ECDHE-ECDSA'],
    algorithmClass: 'asymmetric',
    type: 'protocol',
    quantumStatus: 'shor_vulnerable',
    classicalSecurityBits: 128,
    nistStatus: 'transition',
    oid: '1.3.132.1.12',
    description: 'Elliptic curve key agreement; session keys recoverable with CRQC.',
    recommendedReplacement: 'Hybrid X25519 + ML-KEM-768',
    replacementRationale: 'Dual-encapsulation providing backward compatibility and post-quantum defense.',
  },
  {
    name: 'Ed25519',
    aliases: ['EdDSA', 'Ed448', 'Curve25519-EdDSA'],
    algorithmClass: 'asymmetric',
    type: 'key',
    quantumStatus: 'shor_vulnerable',
    classicalSecurityBits: 128,
    nistStatus: 'fips_186_5_transition',
    oid: '1.3.101.112',
    description: "Edwards-curve signature scheme; broken by Shor's Algorithm on quantum hardware.",
    recommendedReplacement: 'ML-DSA-44 or SLH-DSA (FIPS 205)',
    replacementRationale: 'SLH-DSA provides stateless hash signatures with zero lattice vulnerability.',
  },

  // 2. Classically Broken
  {
    name: 'MD5',
    aliases: ['MD5-HMAC'],
    algorithmClass: 'hash',
    type: 'algorithm',
    quantumStatus: 'classically_broken',
    classicalSecurityBits: 0,
    nistStatus: 'deprecated_broken',
    oid: '1.2.840.113549.2.5',
    description: 'Classically broken hashing function; collision attacks demonstrated in seconds. Insecure today.',
    recommendedReplacement: 'SHA-256 or SHA-384',
    replacementRationale: 'Immediate migration required for classical security integrity.',
  },
  {
    name: 'SHA-1',
    aliases: ['SHA1'],
    algorithmClass: 'hash',
    type: 'algorithm',
    quantumStatus: 'classically_broken',
    classicalSecurityBits: 0,
    nistStatus: 'deprecated_broken',
    oid: '1.3.14.3.2.26',
    description: 'Classically broken digest with practical chosen-prefix collision attacks. Banned by NIST.',
    recommendedReplacement: 'SHA-256 or SHA-384',
    replacementRationale: 'Industry deprecated since 2017 (SHAttered attack).',
  },
  {
    name: 'DES',
    aliases: ['Single-DES'],
    algorithmClass: 'symmetric',
    type: 'algorithm',
    quantumStatus: 'classically_broken',
    classicalSecurityBits: 56,
    nistStatus: 'withdrawn',
    oid: '1.3.14.3.2.7',
    description: '56-bit block cipher vulnerable to brute-force in hours. Completely broken.',
    recommendedReplacement: 'AES-256-GCM',
    replacementRationale: 'Upgrade to AES-256 provides both classical and quantum longevity.',
  },
  {
    name: '3DES',
    aliases: ['Triple DES', 'DES-EDE3', 'TDES'],
    algorithmClass: 'symmetric',
    type: 'algorithm',
    quantumStatus: 'classically_broken',
    classicalSecurityBits: 112,
    nistStatus: 'disallowed',
    oid: '1.2.840.113549.3.7',
    description: '64-bit block size susceptible to Sweet32 birthday collision attacks. Deprecated by NIST in 2023.',
    recommendedReplacement: 'AES-256-GCM',
    replacementRationale: 'Modern 128-bit block size eliminates short-block collision risks.',
  },
  {
    name: 'RC4',
    aliases: ['Arcfour', 'ARC4'],
    algorithmClass: 'symmetric',
    type: 'algorithm',
    quantumStatus: 'classically_broken',
    classicalSecurityBits: 0,
    nistStatus: 'prohibited',
    oid: '1.2.840.113549.3.4',
    description: 'Stream cipher with multiple keystream biases. Banned in TLS RFC 7465.',
    recommendedReplacement: 'ChaCha20-Poly1305 or AES-256-GCM',
    replacementRationale: 'Authenticated ciphers with verified random keystreams.',
  },

  // 3. Grover-Weakened (Symmetric & Hashes)
  {
    name: 'AES-128',
    aliases: ['AES-128-CBC', 'AES-128-GCM', 'AES-128-ECB', 'AES-128-CTR'],
    algorithmClass: 'symmetric',
    type: 'algorithm',
    quantumStatus: 'grover_weakened',
    classicalSecurityBits: 128,
    nistStatus: 'acceptable',
    oid: '2.16.840.1.101.3.4.1.2',
    description: "Grover's Algorithm quadratic speedup reduces effective security from 128 to ~64 bits. Upgrade to AES-256 recommended.",
    recommendedReplacement: 'AES-256-GCM',
    replacementRationale: 'Doubling key size restores 128 bits of effective security under Grover.',
  },
  {
    name: 'SHA-256',
    aliases: ['SHA256'],
    algorithmClass: 'hash',
    type: 'algorithm',
    quantumStatus: 'grover_weakened',
    classicalSecurityBits: 256,
    nistStatus: 'acceptable',
    oid: '2.16.840.1.101.3.4.2.1',
    description: 'Grover collision search reduces bit margin to ~128 bits. Use SHA-384 or SHA-512 for high assurance.',
    recommendedReplacement: 'SHA-384 or SHA-512',
    replacementRationale: 'CNSA 2.0 mandated for national security systems.',
  },

  // 4. Quantum-Safe / Post-Quantum Ready
  {
    name: 'AES-256',
    aliases: ['AES-256-GCM', 'AES-256-CBC', 'AES-256-CTR'],
    algorithmClass: 'symmetric',
    type: 'algorithm',
    quantumStatus: 'quantum_safe',
    classicalSecurityBits: 256,
    nistStatus: 'quantum_resistant_standard',
    oid: '2.16.840.1.101.3.4.1.42',
    description: "Maintains ~128 bits of effective security against Grover's quantum search. Post-quantum approved.",
    recommendedReplacement: 'Currently post-quantum ready (no migration needed)',
    replacementRationale: 'Provides unbreakable 128-bit quantum security margin.',
  },
  {
    name: 'ChaCha20-Poly1305',
    aliases: ['ChaCha20'],
    algorithmClass: 'symmetric',
    type: 'algorithm',
    quantumStatus: 'quantum_safe',
    classicalSecurityBits: 256,
    nistStatus: 'acceptable',
    oid: '1.2.840.113549.1.9.16.3.18',
    description: '256-bit stream cipher with Poly1305 authenticator; robust against quantum search.',
    recommendedReplacement: 'Currently post-quantum ready (no migration needed)',
    replacementRationale: 'Secure 256-bit key length resistant to Grover attacks.',
  },
  {
    name: 'SHA-384',
    aliases: ['SHA384'],
    algorithmClass: 'hash',
    type: 'algorithm',
    quantumStatus: 'quantum_safe',
    classicalSecurityBits: 384,
    nistStatus: 'quantum_resistant_standard',
    oid: '2.16.840.1.101.3.4.2.2',
    description: 'High-margin hash function providing 192 bits of post-quantum collision resistance (CNSA 2.0 standard).',
    recommendedReplacement: 'Currently post-quantum ready',
    replacementRationale: 'Meets NSA CNSA 2.0 requirements for quantum longevity.',
  },
  {
    name: 'ML-KEM-768',
    aliases: ['Kyber768', 'FIPS 203'],
    algorithmClass: 'asymmetric',
    type: 'key',
    quantumStatus: 'quantum_safe',
    classicalSecurityBits: 192,
    nistStatus: 'current_standard',
    oid: '2.16.840.1.101.3.4.4.2',
    description: 'NIST FIPS 203 standardized Module-Lattice Key Encapsulation Mechanism at Security Level 3.',
    recommendedReplacement: 'Primary PQC standard',
    replacementRationale: 'Official replacement for RSA and ECDH key exchange.',
  },
  {
    name: 'ML-DSA-65',
    aliases: ['Dilithium3', 'FIPS 204'],
    algorithmClass: 'asymmetric',
    type: 'algorithm',
    quantumStatus: 'quantum_safe',
    classicalSecurityBits: 192,
    nistStatus: 'current_standard',
    oid: '2.16.840.1.101.3.4.3.18',
    description: 'NIST FIPS 204 standardized Module-Lattice Digital Signature Algorithm at Security Level 3.',
    recommendedReplacement: 'Primary PQC standard',
    replacementRationale: 'Official replacement for RSA and ECDSA signatures.',
  },
  {
    name: 'SLH-DSA-SHA2-128s',
    aliases: ['SPHINCS+', 'FIPS 205'],
    algorithmClass: 'asymmetric',
    type: 'algorithm',
    quantumStatus: 'quantum_safe',
    classicalSecurityBits: 128,
    nistStatus: 'current_standard',
    oid: '2.16.840.1.101.3.4.3.20',
    description: 'NIST FIPS 205 Stateless Hash-Based Digital Signature Standard; zero lattice assumptions.',
    recommendedReplacement: 'Root CA & firmware signing standard',
    replacementRationale: 'Hedge against potential lattice cryptanalysis.',
  },
];

/** Lookup an algorithm by name or alias */
export function lookupAlgorithm(nameOrAlias: string): AlgorithmMetadata | undefined {
  const norm = nameOrAlias.trim().toLowerCase();
  return KNOWN_ALGORITHMS.find(
    (a) => a.name.toLowerCase() === norm || a.aliases.some((al) => al.toLowerCase() === norm)
  );
}
