# Enterprise Cryptographic Discovery & Analysis Tool (ECDAT)
**Smart India Hackathon 2026 | Problem Statement 26164: NTRO**

Enterprise-grade Cryptographic Bill of Materials (CBOM) analytics platform that scans source code repositories, compiled binaries, libraries, and container images to discover all cryptographic primitives, performs quantum risk assessments via Mosca's inequality ($X + Y > Z$), and outputs standardized CycloneDX 1.6 specifications.

---

## ⚡ Quick Start: One Command to Run Both Servers

Run both the FastAPI backend (`:8000`) and Next.js frontend (`:3000`) concurrently with a single command:

```bash
npm run dev:all
```

*Or on Windows:*
```cmd
run.bat
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 🏗️ Architecture Overview

```
cbom-prototype/
├── app/                      # Next.js App Router (TypeScript, React 19, Tailwind)
│   ├── scan/page.tsx         # Scan trigger & live progress polling
│   ├── dashboard/page.tsx    # Executive telemetry, PQC class exposure, top findings
│   ├── artefacts/page.tsx    # Search, filter, sorting, pagination, inline Mosca PATCH
│   ├── risk-graph/page.tsx   # 3-tier deterministic dependency topology
│   └── reports/page.tsx      # CycloneDX 1.6 CBOM preview & multi-format export
├── backend/                  # Python 3.13 FastAPI Engine
│   ├── app/
│   │   ├── scanners/         # Source (AST/regex), Dependency, Cert/Key, Config, Binary, Container
│   │   ├── services/         # Mosca Risk Engine, PQC Recommendations, CBOM Generator, Orchestrator
│   │   ├── routers/          # /api/scans, /api/artefacts, /dashboard, /risk-graph, /reports
│   │   └── models/           # SQLAlchemy Scan and Artefact DB models (SQLite)
│   ├── data/                 # CycloneDX 1.6 schema, NIST PQC mappings, algorithm KB
│   └── tests/                # 15 Pytest unit and E2E integration test suites
├── lib/
│   └── api.ts                # Strongly-typed frontend client using NEXT_PUBLIC_API_URL
└── scripts/
    └── dev.mjs               # Cross-platform concurrent server runner
```

---

## 🧪 Testing & Verification

Run the comprehensive backend pytest suite:

```bash
backend\.venv\Scripts\pytest -v
```

All 15 tests validate:
1. End-to-end repository scan pipeline and persistence
2. Binary scanner (ELF byte fixtures and JAR archives)
3. Container scanner (Docker save `.tar` archive inspection)
4. Strict **CycloneDX 1.6 JSON Schema** validation against official specification
5. Multi-format report generation (CycloneDX 1.6 JSON, CSV, PDF via ReportLab, print-optimised HTML)
6. Exact Mosca inequality calculations ($X + Y > Z$) and risk prioritization

---

## 🎬 Demo Flow

Follow this end-to-end walkthrough to demonstrate the complete ECDAT discovery and risk assessment workflow:

1. **Launch Platform**:
   - Run `npm run dev:all` (or `run.bat` on Windows). Verify backend at `http://localhost:8000/api/health` and frontend at `http://localhost:3000`.
2. **Initiate Discovery Scan (`/scan`)**:
   - Navigate to the **Scan** page.
   - Enter a target Git repository (e.g. `https://github.com/jpadilla/pyjwt`) or select local repository / archive upload.
   - Select targets: Source Code, Binaries, Dependencies, and Containers.
   - Select system exposure (`internal` or `external`) and click **Start Discovery Scan**.
   - Observe real-time staged progress: Workspace initialization $\to$ AST/Regex scanning $\to$ Dependency trees $\to$ Certs/Keys $\to$ Mosca risk evaluation.
3. **Executive Dashboard & Posture (`/dashboard`)**:
   - Inspect top-level KPIs: Total Artefacts Discovered, Source Files Analyzed, Criticality counts, and Shor-vulnerable percentage.
   - Review algorithm breakdowns (Asymmetric, Symmetric, Hash) and the immediate Broken-Today vs. Quantum-Vulnerable posture.
4. **Artefacts Inventory & Dynamic Mosca Recalculation (`/artefacts`)**:
   - Search, filter, and sort discovered cryptographic primitives by risk level (`critical`, `high`, `medium`, `low`) or algorithm type.
   - Inspect individual asset cards showing detection method (AST vs. regex), evidence snippets, key size, and NIST PQC migration alternatives (e.g., ML-DSA, ML-KEM).
   - Test inline parameter tuning: adjust Shelf Life ($X$) or Migration Time ($Y$) on an artefact to witness instant recalculation of Mosca deficit and priority scores via `PATCH /api/artefacts/{id}`.
5. **Deterministic Risk Propagation Graph (`/risk-graph`)**:
   - Explore the 3-tier dependency topology mapping:
     $$\text{Systems / Modules} \longrightarrow \text{Libraries / Dependencies} \longrightarrow \text{Cryptographic Primitives}$$
   - Click nodes to trace how an insecure or quantum-vulnerable primitive cascades risk into dependent microservices.
6. **CycloneDX 1.6 CBOM Export & Reporting (`/reports`)**:
   - Preview the generated CycloneDX 1.6 Cryptographic Bill of Materials (CBOM) with populated `cryptoProperties` conforming to schema specifications.
   - Download the compliance audit package in any format: **CycloneDX 1.6 JSON**, **CSV spreadsheet**, **Executive PDF report**, or **Print-optimized HTML**.

## 🚀 Deployment Guide

This project is architected for seamless multi-cloud deployment:
- **Backend**: Deployed on [Render](https://render.com) as a Docker Web Service.
- **Frontend**: Deployed on [Vercel](https://vercel.com) as a Next.js application.

---

### 1. Backend Deployment (Render)

1. **Create Web Service**:
   - In Render Dashboard, click **New +** $\to$ **Web Service**.
   - Connect your GitHub repository.
2. **Service Settings**:
   - **Environment**: `Docker`
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `Dockerfile` (or leave default `Dockerfile` within the backend root directory)
   - **Health Check Path**: `/api/health`
3. **Environment Variables**:
   Configure the following under the **Environment** tab:
   - `PORT`: Automatically injected by Render (backend binds to `0.0.0.0:$PORT`).
   - `ALLOW_LOCAL_SCANS`: `false` *(disables local filesystem path scans in production cloud)*.
   - `DEV_MODE`: `false`.
   - `CORS_ORIGINS`: `https://your-frontend-domain.vercel.app` *(update with your Vercel URL once deployed; comma-separated if multiple)*.
   - `DATABASE_URL`: `sqlite:///./cbom.db` *(or connection string for Render PostgreSQL if persistent storage is desired)*.
   - `UPLOAD_DIR`: `/tmp/cbom_uploads`.
   - `WORKSPACE_DIR`: `/tmp/cbom_workspaces`.
   - `MAX_UPLOAD_SIZE_BYTES`: `104857600` *(100MB)*.
   - `MAX_REPO_CLONE_SIZE_BYTES`: `262144000` *(250MB)*.
   - `SCAN_TIMEOUT_SECONDS`: `300` *(5 minutes)*.
   - `MAX_CONCURRENT_SCANS`: `3`.
4. **Deploy Service**:
   - Click **Create Web Service**. Once deployed, Render will provide a service URL (e.g., `https://cbom-backend.onrender.com`). Verify by visiting `https://cbom-backend.onrender.com/api/health`.

---

### 2. Frontend Deployment (Vercel)

1. **Import Project**:
   - In Vercel Dashboard, click **Add New...** $\to$ **Project**.
   - Select your GitHub repository.
2. **Project Settings**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (repository root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
3. **Environment Variables**:
   - Add `NEXT_PUBLIC_API_URL` set to your Render backend URL (e.g. `https://cbom-backend.onrender.com`).
   - > [!IMPORTANT]
     > Ensure the URL begins with `https://` and has **NO trailing slash** (e.g. `https://cbom-backend.onrender.com`, NOT `https://cbom-backend.onrender.com/`).
     > In Next.js, `NEXT_PUBLIC_*` variables are inlined at build time. If you update `NEXT_PUBLIC_API_URL`, you **must trigger a redeploy** for changes to take effect.
4. **Deploy**:
   - Click **Deploy**. Vercel will build and assign a domain (e.g., `https://cbom-frontend.vercel.app`).

---

### 3. Connect CORS (Final Sync)

After Vercel assigns your production URL:
1. Copy the Vercel URL (e.g., `https://cbom-frontend.vercel.app`).
2. Go to Render Dashboard $\to$ your backend service $\to$ **Environment**.
3. Update `CORS_ORIGINS` to include your Vercel domain:
   ```env
   CORS_ORIGINS=http://localhost:3000,https://cbom-frontend.vercel.app
   ```
4. Render will automatically redeploy the backend with the new CORS policy.

---

### 4. ⚠️ Free-Tier Caveats & Considerations

- **Cold Starts**: Render free-tier web services spin down after 15 minutes of inactivity. The first request after sleep may take 30–60 seconds to respond as the container spins up. The health check endpoint `/api/health` can be pinged by uptime monitors if keeping it warm is needed.
- **Ephemeral Storage**: Free-tier Render containers use ephemeral disk storage. Any uploaded files or the default SQLite database file (`cbom.db`) will reset on container restart or redeployment. For persistent historical scans across deploys, connect a managed Render PostgreSQL database via the `DATABASE_URL` environment variable.

---

## ⚠️ Known Limitations & Scope

While ECDAT delivers comprehensive static cryptographic inventorying, evaluators should note the following architectural constraints:

1. **Regex & Heuristic False Positives**:
   - The multi-language source scanner pairs AST analysis (Python) with regex pattern matching. Regex rules can match algorithm mentions inside comments, docstrings, type annotations, and error strings (e.g., `raise InvalidKeyError("HMAC key must not be empty.")`).
2. **Test Suite & Mock Fixture Ingestion**:
   - Scan targets without explicit test exclusions will analyze test directories (e.g., `tests/`), capturing mock keys, fixture certificates (`.cer` / `.pem`), and parameterized curve tests as inventory assets.
3. **Static Discovery vs. Runtime Cryptography**:
   - Analysis is performed statically at rest. Runtime-negotiated cipher suites (e.g., dynamic TLS handshake negotiations), hardware HSM key generation, and runtime memory secrets are outside static repository scanning scope.
4. **Binary & Container Inspection Depth**:
   - Container and binary scanners inspect ELF/PE headers, exported symbol tables, byte signatures, and layer tarballs. Deep decompilation and formal symbolic execution of stripped binaries are not currently performed.
5. **Language-Specific AST Depth**:
   - Deep AST syntactic validation is natively implemented for Python (`ast.parse`), whereas JavaScript/TypeScript, Java, Go, and C/C++ currently rely on pattern catalog matching and manifest dependency analysis.

---

## 📄 License & Attribution
Developed for Smart India Hackathon 2026, Problem Statement 26164 (National Technical Research Organisation - NTRO).
