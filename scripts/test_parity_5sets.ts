import { calculateMoscaRisk, MoscaRiskInput } from "../lib/learn/risk_engine";

const test_sets: (MoscaRiskInput & { set: string })[] = [
  {
    set: "Set 1: Shor Deficit (X=10, Y=5, Z=12)",
    name: "RSA-2048",
    path: "backend/auth/jwt_keys/private.pem",
    algo_type: "key",
    quantum_status: "shor_vulnerable",
    business_criticality: "critical",
    shelf_life_years: 10,
    migration_time_years: 5,
    quantum_arrival_years: 12,
    exposure_tag: "external"
  },
  {
    set: "Set 2: Shor Safe Window (X=5, Y=3, Z=12)",
    name: "ECDSA-P256",
    path: "app/controllers/session.go",
    algo_type: "algorithm",
    quantum_status: "shor_vulnerable",
    business_criticality: "medium",
    shelf_life_years: 5,
    migration_time_years: 3,
    quantum_arrival_years: 12,
    exposure_tag: "internal"
  },
  {
    set: "Set 3: Grover Deficit (X=10, Y=4, Z=12)",
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
    set: "Set 4: Classically Broken (X=5, Y=2, Z=12)",
    name: "MD5",
    path: "legacy/token_hasher.py",
    algo_type: "algorithm",
    quantum_status: "classically_broken",
    business_criticality: "high",
    shelf_life_years: 5,
    migration_time_years: 2,
    quantum_arrival_years: 12,
    exposure_tag: "internal"
  },
  {
    set: "Set 5: Quantum Safe (X=10, Y=5, Z=12)",
    name: "ML-KEM-768",
    path: "backend/crypto/pqc_kem.py",
    algo_type: "key",
    quantum_status: "quantum_safe",
    business_criticality: "low",
    shelf_life_years: 10,
    migration_time_years: 5,
    quantum_arrival_years: 12,
    exposure_tag: "internal"
  }
];

const results = test_sets.map(s => {
  const res = calculateMoscaRisk(s);
  return {
    set: s.set,
    verdict: res.verdict,
    margin: res.margin,
    priority_score: res.priority_score,
    risk_level: res.risk_level
  };
});

console.log(JSON.stringify(results, null, 2));
