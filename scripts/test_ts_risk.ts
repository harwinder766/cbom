import {
  calculateMoscaRisk,
  inferCriticalityHeuristically,
  MoscaRiskInput
} from "../lib/learn/risk_engine";

const examples: (MoscaRiskInput & { id: string })[] = [
  {
    id: "Example 1: Healthcare RSA-2048 Key (Shor-Vulnerable)",
    name: "RSA-2048",
    path: "backend/auth/jwt_keys/private.pem",
    algo_type: "key",
    quantum_status: "shor_vulnerable",
    business_criticality: "critical",
    shelf_life_years: 15,
    migration_time_years: 5,
    quantum_arrival_years: 12,
    exposure_tag: "external"
  },
  {
    id: "Example 2: AES-128 Storage Encryption (Grover-Weakened)",
    name: "AES-128-GCM",
    path: "services/storage/encryption.py",
    algo_type: "algorithm",
    quantum_status: "grover_weakened",
    business_criticality: "high",
    shelf_life_years: 10,
    migration_time_years: 4,
    quantum_arrival_years: 12,
    exposure_tag: "internal"
  },
  {
    id: "Example 3: MD5 Legacy Token Digest (Classically Broken)",
    name: "MD5",
    path: "legacy/token_hasher.py",
    algo_type: "algorithm",
    quantum_status: "classically_broken",
    business_criticality: "high",
    shelf_life_years: 5,
    migration_time_years: 2,
    quantum_arrival_years: 12,
    exposure_tag: "internal"
  }
];

const results = examples.map(ex => {
  const inferred_crit = inferCriticalityHeuristically(ex.path, ex.name, ex.algo_type);
  const res = calculateMoscaRisk(ex);
  return {
    id: ex.id,
    inferred_criticality: inferred_crit,
    verdict: res.verdict,
    margin: res.margin,
    priority_score: res.priority_score,
    risk_level: res.risk_level
  };
});

console.log(JSON.stringify(results, null, 2));
