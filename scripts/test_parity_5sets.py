import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.app.services.risk_engine import calculate_mosca_risk

test_sets = [
    {
        "name": "Set 1: Shor Deficit (X=10, Y=5, Z=12)",
        "algo_name": "RSA-2048",
        "path": "backend/auth/jwt_keys/private.pem",
        "algo_type": "key",
        "quantum_status": "shor_vulnerable",
        "business_criticality": "critical",
        "shelf_life_years": 10,
        "migration_time_years": 5,
        "quantum_arrival_years": 12,
        "exposure_tag": "external"
    },
    {
        "name": "Set 2: Shor Safe Window (X=5, Y=3, Z=12)",
        "algo_name": "ECDSA-P256",
        "path": "app/controllers/session.go",
        "algo_type": "algorithm",
        "quantum_status": "shor_vulnerable",
        "business_criticality": "medium",
        "shelf_life_years": 5,
        "migration_time_years": 3,
        "quantum_arrival_years": 12,
        "exposure_tag": "internal"
    },
    {
        "name": "Set 3: Grover Deficit (X=10, Y=4, Z=12)",
        "algo_name": "AES-128-GCM",
        "path": "services/storage/encryption.py",
        "algo_type": "algorithm",
        "quantum_status": "grover_weakened",
        "business_criticality": "high",
        "shelf_life_years": 10,
        "migration_time_years": 4,
        "quantum_arrival_years": 12,
        "exposure_tag": "internal"
    },
    {
        "name": "Set 4: Classically Broken (X=5, Y=2, Z=12)",
        "algo_name": "MD5",
        "path": "legacy/token_hasher.py",
        "algo_type": "algorithm",
        "quantum_status": "classically_broken",
        "business_criticality": "high",
        "shelf_life_years": 5,
        "migration_time_years": 2,
        "quantum_arrival_years": 12,
        "exposure_tag": "internal"
    },
    {
        "name": "Set 5: Quantum Safe (X=10, Y=5, Z=12)",
        "algo_name": "ML-KEM-768",
        "path": "backend/crypto/pqc_kem.py",
        "algo_type": "key",
        "quantum_status": "quantum_safe",
        "business_criticality": "low",
        "shelf_life_years": 10,
        "migration_time_years": 5,
        "quantum_arrival_years": 12,
        "exposure_tag": "internal"
    }
]

results = []
for s in test_sets:
    res = calculate_mosca_risk(
        name=s["algo_name"],
        path=s["path"],
        algo_type=s["algo_type"],
        quantum_status=s["quantum_status"],
        business_criticality=s["business_criticality"],
        shelf_life_years=s["shelf_life_years"],
        migration_time_years=s["migration_time_years"],
        quantum_arrival_years=s["quantum_arrival_years"],
        exposure_tag=s["exposure_tag"]
    )
    results.append({
        "set": s["name"],
        "verdict": res["verdict"],
        "margin": res["margin"],
        "priority_score": res["priority_score"],
        "risk_level": res["risk_level"]
    })

print(json.dumps(results, indent=2))
