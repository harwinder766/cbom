from typing import List, Dict, Any, Set
from backend.app.models.artefact import Artefact

RISK_WEIGHTS = {"critical": 4, "high": 3, "medium": 2, "low": 1}

def build_risk_graph(artefacts: List[Artefact]) -> Dict[str, Any]:
    """
    Constructs a 3-tier semantic risk propagation topology:
    Systems -> Libraries -> Cryptographic Primitives (Artefacts).
    All nodes and edges are strictly derived from real scan findings.
    Coordinates (x, y) are intentionally omitted (computed dynamically by frontend).
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    seen_node_ids: Set[str] = set()
    seen_edge_ids: Set[str] = set()

    system_map: Dict[str, List[Artefact]] = {}
    library_map: Dict[str, List[Artefact]] = {}

    # 1. Group artefacts by system/service directory and library
    for art in artefacts:
        # Determine system/service folder
        parts = art.path.replace("\\", "/").split("/")
        if len(parts) >= 2:
            system_name = f"{parts[0]}/{parts[1]}"
        elif len(parts) == 1:
            system_name = parts[0]
        else:
            system_name = "core"

        system_id = f"sys_{system_name.replace('/', '_').replace('.', '_').replace('-', '_')}"
        if system_id not in system_map:
            system_map[system_id] = []
        system_map[system_id].append(art)

        # If it's a library or declared by a library
        if art.type == "library":
            lib_id = f"lib_{art.name.split()[0].replace('/', '_').replace('.', '_').replace('-', '_').lower()}"
            if lib_id not in library_map:
                library_map[lib_id] = []
            library_map[lib_id].append(art)
        elif art.library:
            lib_id = f"lib_{art.library.replace('/', '_').replace('.', '_').replace('-', '_').lower()}"
            if lib_id not in library_map:
                library_map[lib_id] = []
            library_map[lib_id].append(art)

    # 2. Emit System Nodes
    for sys_id, sys_arts in system_map.items():
        highest_risk = max((a.risk_level for a in sys_arts), key=lambda r: RISK_WEIGHTS.get(r, 0), default="low")
        sys_label = sys_id.replace("sys_", "").replace("_", "/")
        nodes.append({
            "id": sys_id,
            "label": f"Service: {sys_label}",
            "type": "system",
            "riskLevel": highest_risk,
            "description": f"Discovered system component containing {len(sys_arts)} cryptographic assets."
        })
        seen_node_ids.add(sys_id)

    # 3. Emit Library Nodes
    for lib_id, lib_arts in library_map.items():
        highest_risk = max((a.risk_level for a in lib_arts), key=lambda r: RISK_WEIGHTS.get(r, 0), default="low")
        lib_label = lib_arts[0].name if lib_arts and lib_arts[0].type == "library" else lib_id.replace("lib_", "").capitalize()
        nodes.append({
            "id": lib_id,
            "label": lib_label,
            "type": "library",
            "riskLevel": highest_risk,
            "description": f"Cryptographic dependency library detected in manifests or binary symbols."
        })
        seen_node_ids.add(lib_id)

    # 4. Emit Artefact Nodes (Primitives) and Edges
    for art in artefacts:
        if art.type == "library":
            continue # Already handled in library layer

        art_node_id = f"art_{art.id}"
        nodes.append({
            "id": art_node_id,
            "label": art.name,
            "type": "artefact",
            "riskLevel": art.risk_level,
            "description": f"{art.algorithm_class.capitalize()} primitive in {art.path}{(':' + str(art.line)) if art.line else ''}"
        })
        seen_node_ids.add(art_node_id)

        # Connect to system
        parts = art.path.replace("\\", "/").split("/")
        sys_name = f"{parts[0]}/{parts[1]}" if len(parts) >= 2 else parts[0]
        sys_id = f"sys_{sys_name.replace('/', '_').replace('.', '_').replace('-', '_')}"

        # Connect system -> library if library is known
        if art.library:
            lib_id = f"lib_{art.library.replace('/', '_').replace('.', '_').replace('-', '_').lower()}"
            if lib_id in seen_node_ids and sys_id in seen_node_ids:
                edge_id_1 = f"e_{sys_id}_{lib_id}"
                if edge_id_1 not in seen_edge_ids:
                    seen_edge_ids.add(edge_id_1)
                    edges.append({
                        "id": edge_id_1,
                        "from": sys_id,
                        "to": lib_id,
                        "riskLevel": art.risk_level
                    })

                edge_id_2 = f"e_{lib_id}_{art_node_id}"
                if edge_id_2 not in seen_edge_ids:
                    seen_edge_ids.add(edge_id_2)
                    edges.append({
                        "id": edge_id_2,
                        "from": lib_id,
                        "to": art_node_id,
                        "riskLevel": art.risk_level
                    })
        else:
            # Direct System -> Artefact edge
            if sys_id in seen_node_ids:
                edge_id = f"e_{sys_id}_{art_node_id}"
                if edge_id not in seen_edge_ids:
                    seen_edge_ids.add(edge_id)
                    edges.append({
                        "id": edge_id,
                        "from": sys_id,
                        "to": art_node_id,
                        "riskLevel": art.risk_level
                    })

    return {
        "nodes": nodes,
        "edges": edges
    }
