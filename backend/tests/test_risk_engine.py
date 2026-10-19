from backend.app.services.risk_engine import calculate_mosca_risk, infer_criticality_heuristically

def test_classically_broken_risk():
    # MD5 should be broken_today, margin 99, critical/high regardless of Z
    res = calculate_mosca_risk(
        name="MD5",
        path="legacy/checksum.cpp",
        algo_type="algorithm",
        quantum_status="classically_broken",
        business_criticality="critical",
        shelf_life_years=5,
        migration_time_years=2,
        quantum_arrival_years=15
    )
    assert res["verdict"] == "broken_today"
    assert res["risk_level"] == "critical"
    assert res["priority_score"] >= 80

def test_mosca_inequality_violation():
    # X=10, Y=5, Z=12 => X + Y = 15 > 12 => Deficit 3 => violated
    res = calculate_mosca_risk(
        name="RSA-2048",
        path="src/auth/jwt.py",
        algo_type="key",
        quantum_status="shor_vulnerable",
        business_criticality="high",
        shelf_life_years=10,
        migration_time_years=5,
        quantum_arrival_years=12
    )
    assert res["verdict"] == "violated"
    assert res["margin"] == 3
    assert res["risk_level"] == "critical"

def test_mosca_within_window():
    # X=3, Y=2, Z=12 => X + Y = 5 <= 12 => within_window => medium
    res = calculate_mosca_risk(
        name="ECDSA P-256",
        path="services/identity.go",
        algo_type="algorithm",
        quantum_status="shor_vulnerable",
        business_criticality="low",
        shelf_life_years=3,
        migration_time_years=2,
        quantum_arrival_years=12
    )
    assert res["verdict"] == "within_window"
    assert res["margin"] == -7
    assert res["risk_level"] == "medium"

def test_quantum_safe():
    res = calculate_mosca_risk(
        name="AES-256-GCM",
        path="storage/secure.py",
        algo_type="algorithm",
        quantum_status="quantum_safe",
        business_criticality="medium",
        shelf_life_years=10,
        migration_time_years=2,
        quantum_arrival_years=12
    )
    assert res["verdict"] == "quantum_safe"
    assert res["risk_level"] == "low"
