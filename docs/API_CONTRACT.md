# Enterprise Cryptographic Discovery & Analysis Tool (ECDAT)
## API Contract Specification (Phase 0 - Amended)

Version: `1.1.0`  
Standard CBOM Spec: `CycloneDX 1.6`  
Default Base URL: `http://localhost:8000`  
Frontend CORS Origin: `http://localhost:3000`  

> [!IMPORTANT]
> **No Mock / Seed Data Guarantee**: All example JSON payloads in this document are strictly illustrative schema specifications. The backend never returns hardcoded, mock, or seeded scan results. Every returned value is dynamically extracted and analyzed from an actual scan.

---

### Key Architectural Standards

1. **Strict camelCase JSON**: All request and response property names use `camelCase` to directly match the TypeScript frontend codebase.
2. **Stable Artefact ID**: A unique, persistent identifier (e.g., `art_01h8q7x2a`) assigned at discovery time and referenced across all endpoints.
3. **Unified Business Criticality Enum**: Exactly one criticality enum across backend and database: `"low" | "medium" | "high" | "critical"`. (Frontend UI components may map these to display labels such as "Tier-1", "Tier-2", etc.).
4. **Deterministic Graph Layout**: Graph node coordinates (`x`, `y`) are omitted from backend responses; the frontend dynamically maps nodes into 3 deterministic columns (Systems: $x=120$, Libraries: $x=480$, Primitives: $x=840$) based on node type and count.
5. **Pure ISO 8601 Timestamps**: No server-side relative times like "2 minutes ago". All dates are returned as UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
6. **Standard Error Schema**: All 4xx and 5xx responses conform to a unified error envelope.

---

### Standard Error Schema

```json
{
  "error": {
    "code": "SCAN_NOT_FOUND",
    "message": "Scan with id 'scan_01h8q7' does not exist.",
    "details": null
  }
}
```

Standard Error Codes:
- `VALIDATION_ERROR` (422 / 400): Malformed input or invalid parameters.
- `SCAN_NOT_FOUND` (404): Specified scan ID does not exist.
- `NO_SCANS_EXIST` (404): Returned by `/api/scans/latest` when the scan table is empty.
- `ARTEFACT_NOT_FOUND` (404): Specified artefact ID does not exist.
- `LOCAL_PATH_FORBIDDEN` (403): Attempted local scan outside of allowlisted directories.
- `INTERNAL_SCAN_ERROR` (500): Unhandled exception during pipeline execution.

---

### Risk Assessment & Scoring Formula

The backend evaluates each cryptographic finding through a 3-tier deterministic classification:

#### 1. Classically Broken Algorithms (`MD5`, `SHA-1`, `DES`, `3DES`, `RC4`)
- Not evaluated via Mosca quantum timelines because they are **already insecure today**.
- Assigned a `riskLevel` of:
  - `"critical"` if `businessCriticality` is `"critical"` or `"high"`
  - `"high"` if `businessCriticality` is `"medium"` or `"low"`
- `moscaVerdict` is set to `"broken_today"` with `moscaMargin = 99`.

#### 2. Shor-Vulnerable Algorithms (Asymmetric: `RSA`, `DSA`, `DH`, `ECDSA`, `ECDH`, `EdDSA`)
- Evaluated against Mosca's Inequality:
  $$\text{Deficit} = (X + Y) - Z$$
  where:
  - $X$ = `shelfLifeYears`: Years the data must remain confidential (default: 10).
  - $Y$ = `migrationTimeYears`: Years required to migrate systems to PQC (default: 5).
  - $Z$ = `quantumArrivalYears`: Estimated years until a Cryptographically Relevant Quantum Computer (CRQC, default: 12).
- If $X + Y > Z$:
  - `moscaVerdict` = `"violated"` (Deficit $> 0$, Harvest-Now-Decrypt-Later vulnerability).
  - `riskLevel` = `"critical"` if `businessCriticality` $\in \{\text{"critical"}, \text{"high"}\}$; `"high"` otherwise.
- If $X + Y \le Z$:
  - `moscaVerdict` = `"within_window"` (Deficit $\le 0$).
  - `riskLevel` = `"medium"` (migration must still occur before $Z$).

#### 3. Grover-Weakened & Quantum-Resistant Primitives
- **Grover-Weakened** (`AES-128`, `Blowfish`): Effective symmetric strength is halved ($128 \to 64$ bits).
  - `riskLevel` = `"medium"` (Upgrade to AES-256 recommended).
- **Quantum-Resistant** (`AES-256`, `ChaCha20-Poly1305`, `SHA-384`, `SHA-512`, `SHA-3`, NIST PQC primitives):
  - `riskLevel` = `"low"`.

#### Priority Score Calculation (0 - 100)
$$\text{PriorityScore} = \text{clamp}\Big(W_{\text{shor}} \times 40 + W_{\text{mosca}} \times 30 + W_{\text{crit}} \times 20 + W_{\text{exposure}} \times 10, 0, 100\Big)$$
- $W_{\text{shor}}$: 1.0 if Shor-vulnerable or classically broken; 0.4 if Grover-weakened; 0.1 if quantum-safe.
- $W_{\text{mosca}}$: $\min(1.0, \max(0.0, ((X+Y)-Z+5)/15))$.
- $W_{\text{crit}}$: `critical` = 1.0, `high` = 0.75, `medium` = 0.5, `low` = 0.25.
- $W_{\text{exposure}}$: `external` = 1.0, `internal` = 0.5.

---

### Endpoints Specification

#### 0. Health Check
- **Method / Path**: `GET /api/health`
- **Response** (`200 OK`):
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-10-18T10:00:00.000Z"
}
```

---

#### 1. Initiate Scan
- **Method / Path**: `POST /api/scans`
- **Content-Type**: `application/json` or `multipart/form-data`

##### Request Schema (JSON)
```json
{
  "sourceType": "github", // "github" | "local" | "upload" | "image"
  "target": "https://github.com/org/crypto-service", // Git URL, local path, or container image tag
  "scanTargets": {
    "sourceCode": true,
    "binaries": true,
    "dependencies": true,
    "containers": true
  },
  "exposureTag": "internal" // "internal" | "external"
}
```
*Security Constraint for `local`*: `sourceType: "local"` is permitted only in local development mode (`DEV_MODE=true` in backend config) or if `target` is within an allowlisted safe directory. Otherwise returns `403 LOCAL_PATH_FORBIDDEN`.  
*For `upload`*: Submit via `multipart/form-data` with form field `files` containing uploaded source archives, binaries, or container tarballs.

##### Response (`201 Created`)
```json
{
  "id": "scan_01h8q7",
  "status": "queued",
  "sourceType": "github",
  "target": "https://github.com/org/crypto-service",
  "exposureTag": "internal",
  "progress": 0,
  "currentStage": "Initializing workspace sandbox...",
  "artefactsFound": 0,
  "createdAt": "2026-10-18T10:00:00.000Z",
  "completedAt": null
}
```

---

#### 2. List Historical Scans
- **Method / Path**: `GET /api/scans`
- **Query Parameters**:
  - `limit` (integer, default `20`)
  - `offset` (integer, default `0`)

##### Response (`200 OK`)
```json
{
  "total": 3,
  "limit": 20,
  "offset": 0,
  "scans": [
    {
      "id": "scan_01h8q7",
      "status": "completed",
      "sourceType": "github",
      "target": "https://github.com/org/crypto-service",
      "exposureTag": "internal",
      "progress": 100,
      "currentStage": "Done.",
      "artefactsFound": 22,
      "createdAt": "2026-10-18T10:00:00.000Z",
      "completedAt": "2026-10-18T10:00:14.250Z"
    }
  ]
}
```

---

#### 3. Poll Scan Status
- **Method / Path**: `GET /api/scans/{scanId}/status`

##### Response (`200 OK`)
```json
{
  "id": "scan_01h8q7",
  "status": "running", // "queued" | "running" | "completed" | "failed"
  "progress": 68,
  "currentStage": "Checking dependency tree & SBOM manifests...",
  "artefactsFound": 19,
  "error": null,
  "elapsedSeconds": 4.2
}
```

---

#### 4. Dashboard Metrics
- **Method / Path**: `GET /api/scans/{scanId}/dashboard` or `GET /api/scans/latest/dashboard`
*Behavior when no scans exist on `/latest`*: Returns `404 Not Found` with `code: "NO_SCANS_EXIST"`.

##### Response (`200 OK`)
```json
{
  "scanId": "scan_01h8q7",
  "totalArtefacts": 22,
  "sourceFilesCount": 14,
  "systemExposure": "INTERNAL",
  "createdAt": "2026-10-18T10:00:00.000Z",
  "completedAt": "2026-10-18T10:00:14.250Z",
  "criticalCount": 6,
  "highCount": 7,
  "mediumCount": 5,
  "lowCount": 4,
  "criticalPct": 27,
  "highPct": 32,
  "mediumPct": 23,
  "lowPct": 18,
  "quantumVulnerableCount": 11,
  "quantumVulnerablePct": 50,
  "symmetricCount": 7,
  "symmetricPct": 32,
  "hashCount": 4,
  "hashPct": 18,
  "recentFindings": [
    {
      "id": "art_01h8q7x2a",
      "name": "RSA-2048",
      "type": "key",
      "riskLevel": "critical",
      "algorithmClass": "asymmetric",
      "location": "src/auth/jwt_verifier.py:42"
    },
    {
      "id": "art_01h8q7x2b",
      "name": "ECDSA P-256",
      "type": "algorithm",
      "riskLevel": "critical",
      "algorithmClass": "asymmetric",
      "location": "services/identity/crypto_signer.go:118"
    }
  ]
}
```

---

#### 5. Cryptographic Artefacts Inventory (Paginated)
- **Method / Path**: `GET /api/scans/{scanId}/artefacts` or `GET /api/scans/latest/artefacts`
- **Query Parameters**:
  - `search` (string, optional): Substring match on algorithm name or file path.
  - `riskLevel` (string, default `"all"`): `"all"` | `"critical"` | `"high"` | `"medium"` | `"low"`.
  - `type` (string, default `"all"`): `"all"` | `"algorithm"` | `"key"` | `"certificate"` | `"protocol"` | `"library"` | `"cloud_service"` | `"hardware_module"`.
  - `quantumOnly` (boolean, default `false`): If true, returns only Shor-vulnerable assets.
  - `sortBy` (string, default `"riskLevel"`): `"name"` | `"type"` | `"location"` | `"algorithmClass"` | `"riskLevel"` | `"confidence"`.
  - `sortAscending` (boolean, default `false`).
  - `limit` (integer, default `50`, max `200`).
  - `offset` (integer, default `0`).

##### Response (`200 OK`)
```json
{
  "total": 22,
  "limit": 50,
  "offset": 0,
  "artefacts": [
    {
      "id": "art_01h8q7x2a",
      "name": "RSA-2048",
      "type": "key",
      "location": {
        "source": "source",
        "path": "src/auth/jwt_verifier.py",
        "line": 42
      },
      "quantumVulnerable": true,
      "algorithmClass": "asymmetric",
      "confidence": 0.98,
      "riskLevel": "critical",
      "detectionMethod": "ast",
      "evidence": "jwt.decode(token, key=public_key, algorithms=['RS256'])",
      "keySize": 2048,
      "mode": null,
      "version": null,
      "library": "PyJWT",
      "oid": "1.2.840.113549.1.1.1",
      "businessCriticality": "high",
      "dataLifetimeYears": 10,
      "shelfLifeYears": 10,
      "migrationTimeYears": 5,
      "recommendation": {
        "replacement": "ML-DSA-65 (Dilithium3)",
        "latencyNote": "+12% signature generation CPU cycle count",
        "costNote": "Public key size increases from 256 bytes to 1,952 bytes",
        "alternatives": [
          {
            "nistStandard": "FIPS 204 (ML-DSA-65)",
            "isHybrid": false,
            "relativeLatency": 1.12,
            "keySizeBytes": 1952,
            "signatureSizeBytes": 3309,
            "relativeCost": "low",
            "rationale": "Primary NIST standardized digital signature algorithm at security level 3"
          },
          {
            "nistStandard": "Composite (RSA-2048 + ML-DSA-65)",
            "isHybrid": true,
            "relativeLatency": 1.25,
            "keySizeBytes": 2208,
            "signatureSizeBytes": 3565,
            "relativeCost": "medium",
            "rationale": "Hybrid composite signature for backward compatibility with legacy verifiers"
          }
        ]
      }
    }
  ]
}
```

---

#### 6. Single Artefact Details
- **Method / Path**: `GET /api/artefacts/{artefactId}`

##### Response (`200 OK`)
Returns the complete `Artefact` object as shown in Section 5.

---

#### 7. Update Artefact Overrides (Persistence: Per-Artefact)
- **Method / Path**: `PATCH /api/artefacts/{artefactId}`
- **Persistence Behavior**: Directly updates the database record for this single artefact. Recalculates its Mosca verdict, margin, priority score, and resulting risk level.

##### Request Schema
```json
{
  "businessCriticality": "critical", // "low" | "medium" | "high" | "critical"
  "shelfLifeYears": 15,
  "migrationTimeYears": 4
}
```

##### Response (`200 OK`)
Returns the updated `Artefact` with updated `priorityScore`, `moscaVerdict`, and `riskLevel`.

---

#### 8. Mosca Risk Assessment Summary
- **Method / Path**: `GET /api/scans/{scanId}/risk` or `GET /api/scans/latest/risk`

##### Response (`200 OK`)
```json
{
  "scanId": "scan_01h8q7",
  "globalParams": {
    "quantumArrivalYears": 12,
    "defaultShelfLifeYears": 10,
    "defaultMigrationTimeYears": 5
  },
  "summary": {
    "totalEvaluated": 22,
    "violatedCount": 8,
    "withinWindowCount": 3,
    "classicallyBrokenCount": 3,
    "quantumSafeCount": 8,
    "averagePriorityScore": 64.5
  },
  "topRisks": [
    {
      "artefactId": "art_01h8q7x2a",
      "name": "RSA-2048",
      "location": "src/auth/jwt_verifier.py:42",
      "shelfLifeYears": 10,
      "migrationTimeYears": 5,
      "quantumArrivalYears": 12,
      "deficitYears": 3,
      "verdict": "violated",
      "priorityScore": 92
    }
  ]
}
```

---

#### 9. Recalculate Scan Risk (Persistence: Per-Scan)
- **Method / Path**: `POST /api/scans/{scanId}/risk/recalculate`
- **Persistence Behavior**: Updates scan-level defaults (`quantumArrivalYears` / $Z$, `shelfLifeYears`, `migrationTimeYears`) in the database. Re-runs the Mosca calculation for all artefacts in this scan that do not possess explicit per-artefact overrides.

##### Request Schema
```json
{
  "quantumArrivalYears": 10,
  "shelfLifeYears": 8,
  "migrationTimeYears": 4
}
```

##### Response (`200 OK`)
Returns the updated `RiskSummaryResponse` (same shape as Section 8).

---

#### 10. Risk Propagation Graph
- **Method / Path**: `GET /api/scans/{scanId}/risk-graph` or `GET /api/scans/latest/risk-graph`
- **Guarantee**: Every node and edge is dynamically constructed from actual discovered modules, dependencies, and code assets.
- **Node Types**:
  - `system`: Discovered directories, microservices, container services, or configs.
  - `library`: Discovered dependency package manifests or binaries.
  - `artefact`: Discovered cryptographic algorithm, key, or certificate.

##### Response (`200 OK`)
*(Coordinates `x` and `y` are omitted; computed deterministically by frontend).*
```json
{
  "nodes": [
    {
      "id": "sys_auth",
      "label": "Authentication Service (src/auth)",
      "type": "system",
      "riskLevel": "critical",
      "description": "Discovered source package containing JWT verifiers and auth handlers"
    },
    {
      "id": "lib_pycryptodome",
      "label": "PyCryptodome 3.10.1",
      "type": "library",
      "riskLevel": "critical",
      "description": "Declared in requirements.txt (outdated, vulnerable asymmetric primitives)"
    },
    {
      "id": "art_01h8q7x2a",
      "label": "RSA-2048 Key",
      "type": "artefact",
      "riskLevel": "critical",
      "description": "Vulnerable to Shor's algorithm (complete key recovery)"
    }
  ],
  "edges": [
    {
      "id": "e_sys_auth_lib_pycryptodome",
      "from": "sys_auth",
      "to": "lib_pycryptodome",
      "riskLevel": "critical"
    },
    {
      "id": "e_lib_pycryptodome_art_01h8q7x2a",
      "from": "lib_pycryptodome",
      "to": "art_01h8q7x2a",
      "riskLevel": "critical"
    }
  ]
}
```

---

#### 11. Recommendations Roadmap
- **Method / Path**: `GET /api/scans/{scanId}/recommendations` or `GET /api/scans/latest/recommendations`

##### Response (`200 OK`)
```json
{
  "scanId": "scan_01h8q7",
  "recommendations": [
    {
      "artefactId": "art_01h8q7x2a",
      "currentAlgorithm": "RSA-2048",
      "currentClass": "asymmetric",
      "quantumVulnerable": true,
      "riskLevel": "critical",
      "primaryReplacement": "ML-DSA-65 (Dilithium3)",
      "latencyNote": "+12% signature generation CPU cycle count",
      "costNote": "Public key size increases from 256 bytes to 1,952 bytes",
      "alternatives": [
        {
          "nistStandard": "FIPS 204 (ML-DSA-65)",
          "isHybrid": false,
          "relativeLatency": 1.12,
          "keySizeBytes": 1952,
          "signatureSizeBytes": 3309,
          "relativeCost": "low",
          "rationale": "Primary NIST standardized digital signature algorithm at security level 3"
        }
      ]
    }
  ]
}
```

---

#### 12. Reports Summary
- **Method / Path**: `GET /api/scans/{scanId}/reports-summary` or `GET /api/scans/latest/reports-summary`

##### Response (`200 OK`)
```json
{
  "scanId": "scan_01h8q7",
  "quantumRiskItems": [
    {
      "artefactId": "art_01h8q7x2a",
      "name": "RSA-2048",
      "type": "key",
      "location": { "source": "source", "path": "src/auth/jwt_verifier.py", "line": 42 },
      "quantumVulnerable": true,
      "algorithmClass": "asymmetric",
      "detectionMethod": "ast",
      "confidence": 0.98,
      "businessCriticality": "critical",
      "dataLifetimeYears": 10,
      "riskLevel": "critical",
      "recommendation": {
        "replacement": "ML-DSA-65 (Dilithium3)",
        "latencyNote": "+12% signature generation CPU cycle count",
        "costNote": "Public key size increases from 256 bytes to 1,952 bytes",
        "alternatives": []
      }
    }
  ],
  "legacyRiskItems": [
    {
      "artefactId": "art_01h8q7x2c",
      "name": "SHA-1 Digest",
      "type": "algorithm",
      "location": { "source": "source", "path": "legacy/utils/hash_checksum.cpp", "line": 89 },
      "quantumVulnerable": false,
      "algorithmClass": "hash",
      "detectionMethod": "regex_pattern",
      "confidence": 0.89,
      "businessCriticality": "medium",
      "dataLifetimeYears": 5,
      "riskLevel": "high",
      "recommendation": null
    }
  ]
}
```

---

#### 13. Export Report Files
- **Method / Path**: `GET /api/scans/{scanId}/report?format={cbom|csv|pdf|html}`

##### Format Handling:
- `format=cbom` (Default): Returns valid **CycloneDX 1.6 CBOM JSON** (`Content-Type: application/json; charset=utf-8`) with `components[].type = "cryptographic-asset"` and `cryptoProperties` fully populated.
- `format=csv`: Returns raw CSV spreadsheet (`Content-Type: text/csv`).
- `format=pdf`: Returns generated executive Post-Quantum Cryptographic Readiness Summary (`Content-Type: application/pdf`).
- `format=html`: Returns interactive standalone HTML report (`Content-Type: text/html`).
