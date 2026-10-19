from typing import Dict, Any, Tuple
from backend.app.services.knowledge_base import kb

def infer_criticality_heuristically(path: str, name: str, algo_type: str) -> str:
    """Infers business criticality from path context and asset type."""
    p_lower = path.lower()
    n_lower = name.lower()

    # Critical paths: auth, token, payment, ingress, root ca, secrets
    if any(k in p_lower for k in ["auth", "jwt", "login", "sso", "identity", "token"]):
        return "critical"
    if any(k in p_lower for k in ["payment", "billing", "checkout", "pci", "card"]):
        return "critical"
    if any(k in p_lower for k in ["root_ca", "root-ca", "ca.crt", "ingress", "gateway"]):
        return "critical"
    if "key" in algo_type or "private" in p_lower or "secret" in p_lower:
        return "critical"

    # High paths: storage encryption, secure comms, api security
    if any(k in p_lower for k in ["storage", "s3", "vault", "kms", "crypto", "tls", "ssl"]):
        return "high"
    if any(k in p_lower for k in ["ssh", "session", "wireguard", "vpn"]):
        return "high"

    # Low paths: test, mock, fixture, example
    if any(k in p_lower for k in ["test", "mock", "fixture", "example", "sample", "spec"]):
        return "low"

    return "medium"

def calculate_mosca_risk(
    name: str,
    path: str,
    algo_type: str,
    quantum_status: str,
    business_criticality: str,
    shelf_life_years: int,
    migration_time_years: int,
    quantum_arrival_years: int,
    exposure_tag: str = "internal"
) -> Dict[str, Any]:
    """
    Computes exact Mosca verdict, margin, priority score (0-100), and risk level.
    """
    deficit = (shelf_life_years + migration_time_years) - quantum_arrival_years

    # 1. Classically Broken
    if quantum_status == "classically_broken":
        verdict = "broken_today"
        margin = 99
        risk_level = "critical" if business_criticality in ["critical", "high"] else "high"
        w_shor = 1.0
        w_mosca = 1.0

    # 2. Shor-Vulnerable
    elif quantum_status == "shor_vulnerable":
        w_shor = 1.0
        if deficit > 0:
            verdict = "violated"
            margin = deficit
            risk_level = "critical" if business_criticality in ["critical", "high"] else "high"
            w_mosca = min(1.0, max(0.0, (deficit + 5) / 15.0))
        else:
            verdict = "within_window"
            margin = deficit
            risk_level = "medium"
            w_mosca = 0.2

    # 3. Grover-Weakened
    elif quantum_status == "grover_weakened":
        verdict = "quantum_safe" if deficit <= 0 else "grover_weakened"
        margin = max(0, deficit)
        risk_level = "medium"
        w_shor = 0.4
        w_mosca = 0.1

    # 4. Quantum-Safe / Resistant
    else:
        verdict = "quantum_safe"
        margin = 0
        risk_level = "low"
        w_shor = 0.1
        w_mosca = 0.0

    # Priority score calculation
    crit_weights = {"critical": 1.0, "high": 0.75, "medium": 0.5, "low": 0.25}
    w_crit = crit_weights.get(business_criticality, 0.5)
    w_exposure = 1.0 if exposure_tag == "external" else 0.5

    raw_score = (w_shor * 40.0) + (w_mosca * 30.0) + (w_crit * 20.0) + (w_exposure * 10.0)
    priority_score = int(round(max(0, min(100, raw_score))))

    return {
        "verdict": verdict,
        "margin": margin,
        "priority_score": priority_score,
        "risk_level": risk_level
    }
