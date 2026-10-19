/**
 * ECDAT Typed API Client
 * Enterprise Cryptographic Discovery & Analysis Tool
 * Spec: docs/API_CONTRACT.md (v1.1.0)
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type ArtefactType = 'algorithm' | 'key' | 'certificate' | 'protocol' | 'library' | 'cloud_service';
export type AlgorithmClass = 'asymmetric' | 'symmetric' | 'hash';
export type SourceOrigin = 'source' | 'binary' | 'container' | 'dependency';
export type BusinessCriticality = 'low' | 'medium' | 'high' | 'critical';

export interface ScanResponse {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  target: string;
  type: 'github' | 'local' | 'upload';
  exposure: 'internal' | 'external';
  createdAt: string;
  completedAt?: string | null;
  totalArtefacts: number;
  criticalCount: number;
  highCount: number;
  quantumCount: number;
  error?: string | null;
}

export interface ScanStatusResponse {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStage: string;
  artefactsFound: number;
  completedAt?: string | null;
  error?: string | null;
}

export interface CreateScanRequest {
  type: 'github' | 'local';
  target: string;
  exposure?: 'internal' | 'external';
  options?: {
    sourceCode?: boolean;
    binaries?: boolean;
    dependencies?: boolean;
    containers?: boolean;
  };
}

export interface RecommendationInfo {
  replacement: string;
  latencyNote: string;
  costNote: string;
  alternatives?: string[];
}

export interface ArtefactItem {
  id: string;
  scanId: string;
  name: string;
  type: ArtefactType;
  algorithmClass: AlgorithmClass;
  location: {
    source: SourceOrigin;
    path: string;
    line?: number | null;
  };
  quantumVulnerable: boolean;
  confidence: number;
  riskLevel: RiskLevel;
  detectionMethod: string;
  businessCriticality: BusinessCriticality;
  shelfLifeYears: number;
  migrationTimeYears: number;
  quantumHorizonYears: number;
  moscaViolated: boolean;
  priorityScore: number;
  keySize?: number | null;
  mode?: string | null;
  version?: string | null;
  oid?: string | null;
  evidence?: string | null;
  recommendation?: RecommendationInfo | null;
}

export interface DashboardFinding {
  id: string;
  name: string;
  type: string;
  riskLevel: RiskLevel;
  algorithmClass?: string;
  location: string | { source?: string; path: string; line?: number | null };
}

export interface DashboardMetricsResponse {
  scanId?: string;
  totalArtefacts: number;
  sourceFilesCount?: number;
  systemExposure?: string;
  criticalCount?: number;
  criticalFindings?: number;
  highCount?: number;
  highFindings?: number;
  mediumCount?: number;
  lowCount?: number;
  criticalPct?: number;
  highPct?: number;
  mediumPct?: number;
  lowPct?: number;
  quantumVulnerableCount?: number;
  quantumVulnerable?: number;
  symmetricCount?: number;
  hashCount?: number;
  riskScore?: number;
  moscaCriticalCount?: number;
  recentFindings?: DashboardFinding[];
  topFindings?: DashboardFinding[];
  classExposure?: {
    asymmetric: number;
    symmetric: number;
    hash: number;
    other: number;
  };
  riskDistribution?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scanMetadata?: {
    id: string;
    target: string;
    completedAt?: string | null;
  };
}

export interface ArtefactsQueryParams {
  search?: string;
  riskLevel?: RiskLevel | 'all';
  type?: ArtefactType | 'all';
  quantumOnly?: boolean;
  sortBy?: 'name' | 'riskLevel' | 'businessCriticality' | 'shelfLifeYears';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ArtefactsResponse {
  artefacts: ArtefactItem[];
  items?: ArtefactItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface UpdateArtefactRequest {
  businessCriticality?: BusinessCriticality;
  shelfLifeYears?: number;
  migrationTimeYears?: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'system' | 'library' | 'artefact';
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  description: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

export interface RiskGraphResponse {
  scanId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ReportArtefactItem {
  artefactId: string;
  name: string;
  type: string;
  location: {
    source: string;
    path: string;
    line?: number | null;
  };
  quantumVulnerable: boolean;
  algorithmClass: string;
  detectionMethod: string;
  confidence: number;
  businessCriticality: string;
  dataLifetimeYears: number;
  riskLevel: RiskLevel;
  recommendation?: RecommendationInfo | null;
}

export interface ReportsSummaryResponse {
  scanId: string;
  quantumRiskItems: ReportArtefactItem[];
  legacyRiskItems: ReportArtefactItem[];
}

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

// Active Scan Persistence in LocalStorage
const ACTIVE_SCAN_STORAGE_KEY = 'cbom_active_scan_id';

export function getActiveScanId(): string {
  if (typeof window === 'undefined') return 'latest';
  return localStorage.getItem(ACTIVE_SCAN_STORAGE_KEY) || 'latest';
}

export function setActiveScanId(id: string): void {
  if (typeof window !== 'undefined' && id) {
    localStorage.setItem(ACTIVE_SCAN_STORAGE_KEY, id);
  }
}

export interface ServerConfigResponse {
  allowLocalScans: boolean;
  maxUploadSizeBytes: number;
  maxRepoCloneSizeBytes: number;
  scanTimeoutSeconds: number;
  maxConcurrentScans: number;
}

// HTTP Helper with custom error handling
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson?.error?.message) {
          errorDetail = errorJson.error.message;
        } else if (errorJson?.detail?.error?.message) {
          errorDetail = errorJson.detail.error.message;
        } else if (typeof errorJson?.detail === 'string') {
          errorDetail = errorJson.detail;
        } else if (errorJson?.message) {
          errorDetail = errorJson.message;
        }
      } catch {
        // use default errorDetail
      }
      throw new Error(errorDetail);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
      throw new Error('Backend service is offline. Please verify FastAPI is running at ' + API_BASE);
    }
    throw err;
  }
}

// API Client Methods
export const api = {
  // Configuration
  getConfig: () => request<ServerConfigResponse>('/api/config'),

  // Health
  checkHealth: () => request<HealthResponse>('/api/health'),

  // Scans
  listScans: () => request<ScanResponse[]>('/api/scans'),

  getScan: (scanId: string) => request<ScanResponse>(`/api/scans/${scanId}`),

  startScan: (payload: CreateScanRequest) =>
    request<ScanResponse>('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        sourceType: payload.type,
        exposureTag: payload.exposure || 'internal',
      }),
    }),

  uploadScan: async (
    files: (File | { file: File; relativePath?: string })[],
    exposure: 'internal' | 'external' = 'internal'
  ) => {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    for (const item of fileList) {
      if ('file' in item && item.file instanceof File) {
        const path = item.relativePath || (item.file as any).webkitRelativePath || item.file.name;
        formData.append('files', item.file, path);
      } else if (item instanceof File) {
        const path = (item as any).webkitRelativePath || item.name;
        formData.append('files', item, path);
      }
    }
    formData.append('exposureTag', exposure);

    const res = await fetch(`${API_BASE}/api/scans/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message ||
        err?.detail?.error?.message ||
        (typeof err?.detail === 'string' ? err.detail : `Upload failed with status ${res.status}`)
      );
    }

    return (await res.json()) as ScanResponse;
  },

  getScanStatus: (scanId: string) => request<ScanStatusResponse>(`/api/scans/${scanId}/status`),

  // Dashboard
  getDashboardMetrics: (scanId: string = 'latest') =>
    request<DashboardMetricsResponse>(`/api/scans/${scanId}/dashboard`),

  // Artefacts
  getArtefacts: (scanId: string = 'latest', params: ArtefactsQueryParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.riskLevel && params.riskLevel !== 'all') searchParams.set('riskLevel', params.riskLevel);
    if (params.type && params.type !== 'all') searchParams.set('type', params.type);
    if (params.quantumOnly !== undefined) searchParams.set('quantumOnly', String(params.quantumOnly));
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.order) searchParams.set('order', params.order);
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.offset !== undefined) searchParams.set('offset', String(params.offset));

    const qs = searchParams.toString();
    return request<ArtefactsResponse>(`/api/scans/${scanId}/artefacts${qs ? `?${qs}` : ''}`);
  },

  getArtefact: (id: string) => request<ArtefactItem>(`/api/artefacts/${id}`),

  updateArtefact: (id: string, payload: UpdateArtefactRequest) =>
    request<ArtefactItem>(`/api/artefacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // Risk Graph
  getRiskGraph: (scanId: string = 'latest') =>
    request<RiskGraphResponse>(`/api/scans/${scanId}/risk-graph`),

  // Reports
  getReportsSummary: (scanId: string = 'latest') =>
    request<ReportsSummaryResponse>(`/api/scans/${scanId}/reports-summary`),

  getReportDownloadUrl: (scanId: string = 'latest', format: 'cbom' | 'csv' | 'pdf' | 'html') =>
    `${API_BASE}/api/scans/${scanId}/report?format=${format}`,
};
