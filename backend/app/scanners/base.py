from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from pathlib import Path

@dataclass
class CryptoAssetResult:
    name: str
    type: str # algorithm, key, certificate, protocol, library, cloud_service, hardware_module
    algorithm_class: str # asymmetric, symmetric, hash
    path: str
    line: Optional[int] = None
    source_origin: str = "source" # source, binary, container, dependency
    confidence: float = 1.0
    detection_method: str = "regex_pattern" # regex_pattern, ast, dependency_manifest, x509_parse, config_parse, binary_signature
    evidence: Optional[str] = None
    key_size: Optional[int] = None
    mode: Optional[str] = None
    version: Optional[str] = None
    library: Optional[str] = None
    oid: Optional[str] = None

class BaseScanner(ABC):
    @abstractmethod
    def scan(self, target_dir: Path) -> List[CryptoAssetResult]:
        """Scans the target directory and returns discovered cryptographic assets."""
        pass
