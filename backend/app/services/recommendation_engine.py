from typing import Dict, Any, Optional, List
from backend.app.services.knowledge_base import kb

def get_recommendation_for_asset(name: str) -> Optional[Dict[str, Any]]:
    """Retrieves NIST PQC migration alternatives and trade-off notes."""
    rec_data = kb.get_recommendation(name)
    if not rec_data:
        return None

    return {
        "replacement": rec_data.get("primaryReplacement", "PQC Standard Hybrid"),
        "latencyNote": rec_data.get("latencyNote", "Minimal latency impact under hardware-accelerated instructions"),
        "costNote": rec_data.get("costNote", "Payload size updates required for public key and signature buffers"),
        "alternatives": rec_data.get("alternatives", [])
    }
