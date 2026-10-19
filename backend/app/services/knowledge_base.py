import json
from pathlib import Path
from typing import Dict, Any, Optional, List
from backend.app.config import settings

class KnowledgeBase:
    _instance = None

    def __init__(self):
        data_dir = Path(settings.data_dir)
        self.algorithms_raw = []
        self.recommendations_raw = {}
        self.known_libraries_raw = {}

        algo_file = data_dir / "algorithms.json"
        if algo_file.exists():
            with open(algo_file, "r", encoding="utf-8") as f:
                self.algorithms_raw = json.load(f).get("algorithms", [])

        rec_file = data_dir / "pqc_recommendations.json"
        if rec_file.exists():
            with open(rec_file, "r", encoding="utf-8") as f:
                self.recommendations_raw = json.load(f).get("recommendations", {})

        lib_file = data_dir / "known_libraries.json"
        if lib_file.exists():
            with open(lib_file, "r", encoding="utf-8") as f:
                self.known_libraries_raw = json.load(f).get("libraries", {})

        # Index algorithms by normalized name & alias
        self.algo_index: Dict[str, Dict[str, Any]] = {}
        for entry in self.algorithms_raw:
            primary_name = entry["name"]
            self.algo_index[primary_name.lower()] = entry
            for alias in entry.get("aliases", []):
                self.algo_index[alias.lower()] = entry

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = KnowledgeBase()
        return cls._instance

    def lookup_algorithm(self, name_or_alias: str) -> Optional[Dict[str, Any]]:
        norm = name_or_alias.strip().lower()
        if norm in self.algo_index:
            return self.algo_index[norm]
        
        # Partial match if exact not found
        for k, v in self.algo_index.items():
            if k in norm or norm in k:
                return v
        return None

    def get_recommendation(self, algo_name: str) -> Optional[Dict[str, Any]]:
        entry = self.lookup_algorithm(algo_name)
        primary_name = entry["name"] if entry else algo_name
        
        if primary_name in self.recommendations_raw:
            return self.recommendations_raw[primary_name]
        
        # Fallback check aliases in recommendations
        for k, rec in self.recommendations_raw.items():
            if k.lower() in primary_name.lower() or primary_name.lower() in k.lower():
                return rec
        return None

    def lookup_library(self, package_name: str) -> Optional[Dict[str, Any]]:
        norm = package_name.strip().lower()
        for k, v in self.known_libraries_raw.items():
            if k.lower() == norm or v.get("package", "").lower() == norm:
                return v
        return None

kb = KnowledgeBase.get_instance()
