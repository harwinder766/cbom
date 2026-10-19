/**
 * Pure TypeScript mirror of backend/app/services/risk_engine.py
 *
 * MIRRORS: backend/app/services/risk_engine.py
 * Maintains 100% mathematical and logical fidelity without requiring backend network calls.
 */

export type QuantumStatus =
  | 'classically_broken'
  | 'shor_vulnerable'
  | 'grover_weakened'
  | 'quantum_safe';

export type BusinessCriticality = 'critical' | 'high' | 'medium' | 'low';

export type ExposureTag = 'internal' | 'external';

export type MoscaVerdict =
  | 'broken_today'
  | 'violated'
  | 'within_window'
  | 'grover_weakened'
  | 'quantum_safe';

export interface MoscaRiskInput {
  name: string;
  path: string;
  algo_type: string;
  quantum_status: QuantumStatus;
  business_criticality: BusinessCriticality;
  shelf_life_years: number; // X
  migration_time_years: number; // Y
  quantum_arrival_years: number; // Z
  exposure_tag?: ExposureTag;
}

export interface MoscaRiskResult {
  verdict: MoscaVerdict;
  margin: number;
  priority_score: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  deficit: number;
  w_shor: number;
  w_mosca: number;
  w_crit: number;
  w_exposure: number;
  raw_score: number;
}

/**
 * Infers business criticality from path context and asset type.
 * Mirrors: backend/app/services/risk_engine.py -> infer_criticality_heuristically
 */
export function inferCriticalityHeuristically(
  path: string,
  name: string,
  algo_type: string
): BusinessCriticality {
  const pLower = path.toLowerCase();
  const nLower = name.toLowerCase();

  // Critical paths: auth, token, payment, ingress, root ca, secrets
  if (['auth', 'jwt', 'login', 'sso', 'identity', 'token'].some((k) => pLower.includes(k))) {
    return 'critical';
  }
  if (['payment', 'billing', 'checkout', 'pci', 'card'].some((k) => pLower.includes(k))) {
    return 'critical';
  }
  if (['root_ca', 'root-ca', 'ca.crt', 'ingress', 'gateway'].some((k) => pLower.includes(k))) {
    return 'critical';
  }
  if (algo_type.includes('key') || pLower.includes('private') || pLower.includes('secret')) {
    return 'critical';
  }

  // High paths: storage encryption, secure comms, api security
  if (['storage', 's3', 'vault', 'kms', 'crypto', 'tls', 'ssl'].some((k) => pLower.includes(k))) {
    return 'high';
  }
  if (['ssh', 'session', 'wireguard', 'vpn'].some((k) => pLower.includes(k))) {
    return 'high';
  }

  // Low paths: test, mock, fixture, example
  if (['test', 'mock', 'fixture', 'example', 'sample', 'spec'].some((k) => pLower.includes(k))) {
    return 'low';
  }

  return 'medium';
}

/**
 * Computes exact Mosca verdict, margin, priority score (0-100), and risk level.
 * Mirrors: backend/app/services/risk_engine.py -> calculate_mosca_risk
 */
export function calculateMoscaRisk(input: MoscaRiskInput): MoscaRiskResult {
  const {
    name,
    path,
    algo_type,
    quantum_status,
    business_criticality,
    shelf_life_years,
    migration_time_years,
    quantum_arrival_years,
    exposure_tag = 'internal',
  } = input;

  const deficit = shelf_life_years + migration_time_years - quantum_arrival_years;

  let verdict: MoscaVerdict;
  let margin: number;
  let risk_level: 'critical' | 'high' | 'medium' | 'low';
  let w_shor: number;
  let w_mosca: number;

  // 1. Classically Broken
  if (quantum_status === 'classically_broken') {
    verdict = 'broken_today';
    margin = 99;
    risk_level =
      business_criticality === 'critical' || business_criticality === 'high' ? 'critical' : 'high';
    w_shor = 1.0;
    w_mosca = 1.0;
  }
  // 2. Shor-Vulnerable
  else if (quantum_status === 'shor_vulnerable') {
    w_shor = 1.0;
    if (deficit > 0) {
      verdict = 'violated';
      margin = deficit;
      risk_level =
        business_criticality === 'critical' || business_criticality === 'high' ? 'critical' : 'high';
      w_mosca = Math.min(1.0, Math.max(0.0, (deficit + 5) / 15.0));
    } else {
      verdict = 'within_window';
      margin = deficit;
      risk_level = 'medium';
      w_mosca = 0.2;
    }
  }
  // 3. Grover-Weakened
  else if (quantum_status === 'grover_weakened') {
    verdict = deficit <= 0 ? 'quantum_safe' : 'grover_weakened';
    margin = Math.max(0, deficit);
    risk_level = 'medium';
    w_shor = 0.4;
    w_mosca = 0.1;
  }
  // 4. Quantum-Safe / Resistant
  else {
    verdict = 'quantum_safe';
    margin = 0;
    risk_level = 'low';
    w_shor = 0.1;
    w_mosca = 0.0;
  }

  // Priority score calculation
  const critWeights: Record<BusinessCriticality, number> = {
    critical: 1.0,
    high: 0.75,
    medium: 0.5,
    low: 0.25,
  };
  const w_crit = critWeights[business_criticality] ?? 0.5;
  const w_exposure = exposure_tag === 'external' ? 1.0 : 0.5;

  const raw_score = w_shor * 40.0 + w_mosca * 30.0 + w_crit * 20.0 + w_exposure * 10.0;
  const priority_score = Math.round(Math.max(0, Math.min(100, raw_score)));

  return {
    verdict,
    margin,
    priority_score,
    risk_level,
    deficit,
    w_shor,
    w_mosca,
    w_crit,
    w_exposure,
    raw_score,
  };
}
