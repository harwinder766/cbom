'use client';

import React, { useState, useMemo, useRef, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppNav from '@/app/components/navbar';
import {
  api,
  GraphNode,
  GraphEdge,
  RiskGraphResponse,
  getActiveScanId,
  setActiveScanId,
} from '@/lib/api';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Filter,
  ShieldAlert,
  Layers,
  ExternalLink,
  X,
} from 'lucide-react';

// ============================================================================
// Types & Color Mappings
// ============================================================================

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

const RISK_COLOR_MAP: Record<
  RiskLevel,
  { stroke: string; fill: string; badgeBg: string; text: string; dot: string; glow: string }
> = {
  critical: {
    stroke: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.18)',
    badgeBg: 'bg-red-950/80 border-red-800/60 text-red-300',
    text: 'text-red-400',
    dot: 'bg-red-500',
    glow: 'rgba(239, 68, 68, 0.45)',
  },
  high: {
    stroke: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.18)',
    badgeBg: 'bg-amber-950/80 border-amber-800/60 text-amber-300',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    glow: 'rgba(245, 158, 11, 0.45)',
  },
  medium: {
    stroke: '#60a5fa',
    fill: 'rgba(96, 165, 250, 0.18)',
    badgeBg: 'bg-blue-950/80 border-blue-800/60 text-blue-300',
    text: 'text-blue-400',
    dot: 'bg-blue-500',
    glow: 'rgba(96, 165, 250, 0.35)',
  },
  low: {
    stroke: '#94a3b8',
    fill: 'rgba(148, 163, 184, 0.18)',
    badgeBg: 'bg-slate-800 border-slate-700 text-slate-300',
    text: 'text-slate-400',
    dot: 'bg-slate-400',
    glow: 'rgba(148, 163, 184, 0.2)',
  },
  none: {
    stroke: '#334155',
    fill: 'rgba(51, 65, 85, 0.2)',
    badgeBg: 'bg-slate-900 border-slate-800 text-slate-400',
    text: 'text-slate-400',
    dot: 'bg-slate-600',
    glow: 'none',
  },
};

const VENDOR_TEST_PATTERN = /(?:^|[/\\])(?:tests?|vendor|node_modules|fixtures?|docs?)(?:[/\\]|$)/i;

interface FindingItem {
  id: string;
  name: string;
  type: string;
  riskLevel: RiskLevel;
  path: string;
  line?: number | null;
  description?: string;
}

interface AggregatedNode {
  id: string;
  label: string;
  rawLabel: string;
  type: 'system' | 'library' | 'artefact';
  riskLevel: RiskLevel;
  count: number;
  description: string;
  isGroup?: boolean;
  originalNodeIds: string[];
  findings: FindingItem[];
  x: number;
  y: number;
  radius: number;
}

interface AggregatedEdge {
  id: string;
  from: string;
  to: string;
  count: number;
  riskLevel: RiskLevel;
}

// ============================================================================
// Main Risk Graph Content
// ============================================================================

function RiskGraphContent() {
  const searchParams = useSearchParams();
  const queryScanId = searchParams.get('scan_id');
  const [scanId, setScanId] = useState<string>('latest');

  const [rawNodes, setRawNodes] = useState<GraphNode[]>([]);
  const [rawEdges, setRawEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Aggregation Controls
  const [topN, setTopN] = useState<number>(8); // 5 | 8 | 15 | Infinity
  const [includeTests, setIncludeTests] = useState<boolean>(false); // default OFF
  const [riskFilters, setRiskFilters] = useState<Record<RiskLevel, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: true,
    none: true,
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandOtherSystems, setExpandOtherSystems] = useState<boolean>(false);
  const [expandOtherLibraries, setExpandOtherLibraries] = useState<boolean>(false);

  // Interaction State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Viewport Transform (Zoom / Pan)
  const [transform, setTransform] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; transX: number; transY: number }>({
    clientX: 0,
    clientY: 0,
    transX: 0,
    transY: 0,
  });
  const graphContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const resolvedId = queryScanId || getActiveScanId() || 'latest';
    setScanId(resolvedId);
    if (resolvedId && resolvedId !== 'latest') {
      setActiveScanId(resolvedId);
    }
  }, [queryScanId]);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: RiskGraphResponse = await api.getRiskGraph(scanId);
      setRawNodes(data.nodes || []);
      setRawEdges(data.edges || []);
      setExpandOtherSystems(false);
      setExpandOtherLibraries(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load risk propagation graph.');
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // ==========================================================================
  // Graph Aggregation & Layout Computation
  // ==========================================================================
  const {
    nodes: visibleNodes,
    edges: visibleEdges,
    virtualWidth,
    virtualHeight,
  } = useMemo(() => {
    if (rawNodes.length === 0) {
      return { nodes: [], edges: [], virtualWidth: 1100, virtualHeight: 560 };
    }

    const rawNodeMap = new Map<string, GraphNode>();
    rawNodes.forEach((n) => rawNodeMap.set(n.id, n));

    let rawSystems = rawNodes.filter((n) => n.type === 'system');
    let rawLibraries = rawNodes.filter((n) => n.type === 'library');
    let rawArtefacts = rawNodes.filter((n) => n.type === 'artefact');

    // 1. Filter tests / vendored code if toggle is OFF
    if (!includeTests) {
      rawSystems = rawSystems.filter(
        (s) =>
          !VENDOR_TEST_PATTERN.test(s.label) &&
          !VENDOR_TEST_PATTERN.test(s.description || '') &&
          !VENDOR_TEST_PATTERN.test(s.id)
      );
    }

    const validSystemIds = new Set(rawSystems.map((s) => s.id));
    const sysToLibEdges = rawEdges.filter((e) => validSystemIds.has(e.from));
    const validLibIds = new Set(sysToLibEdges.map((e) => e.to));
    rawLibraries = rawLibraries.filter((l) => validLibIds.has(l.id));

    const validTargetEdges = rawEdges.filter(
      (e) => validSystemIds.has(e.from) || validLibIds.has(e.from)
    );
    const reachableArtefactIds = new Set(validTargetEdges.map((e) => e.to));
    rawArtefacts = rawArtefacts.filter((a) => reachableArtefactIds.has(a.id));

    // 2. Risk Filter: filter artefacts by active risk filter
    rawArtefacts = rawArtefacts.filter((a) => riskFilters[a.riskLevel as RiskLevel] !== false);

    const activeArtIds = new Set(rawArtefacts.map((a) => a.id));
    const activeEdges = validTargetEdges.filter(
      (e) => activeArtIds.has(e.to) || validLibIds.has(e.to)
    );

    // 3. TIER 3 AGGREGATION: Group artefacts by distinct algorithm/asset name
    const algoGroups = new Map<
      string,
      {
        name: string;
        rawNodes: GraphNode[];
        riskLevels: RiskLevel[];
      }
    >();

    rawArtefacts.forEach((art) => {
      const algoName = art.label.trim();
      if (!algoGroups.has(algoName)) {
        algoGroups.set(algoName, { name: algoName, rawNodes: [], riskLevels: [] });
      }
      const grp = algoGroups.get(algoName)!;
      grp.rawNodes.push(art);
      grp.riskLevels.push(art.riskLevel as RiskLevel);
    });

    const tier3Nodes: AggregatedNode[] = Array.from(algoGroups.values()).map((grp) => {
      const highestRisk = grp.riskLevels.reduce(
        (best, curr) => (RISK_WEIGHTS[curr] > RISK_WEIGHTS[best] ? curr : best),
        'none' as RiskLevel
      );
      const count = grp.rawNodes.length;
      const id = `art_kind_${grp.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      const findings: FindingItem[] = grp.rawNodes.map((rn) => {
        const match = rn.description?.match(/in\s+([^\s:]+)(?::(\d+))?/);
        return {
          id: rn.id,
          name: rn.label,
          type: 'artefact',
          riskLevel: rn.riskLevel as RiskLevel,
          path: match ? match[1] : rn.description || '',
          line: match && match[2] ? parseInt(match[2], 10) : null,
          description: rn.description,
        };
      });

      return {
        id,
        label: `${grp.name} x${count}`,
        rawLabel: grp.name,
        type: 'artefact',
        riskLevel: highestRisk,
        count,
        description: `Aggregated ${count} occurrences of ${grp.name}.`,
        originalNodeIds: grp.rawNodes.map((n) => n.id),
        findings,
        x: 820,
        y: 0,
        radius: Math.min(26, Math.max(16, 16 + Math.sqrt(count) * 1.6)),
      };
    });

    tier3Nodes.sort((a, b) => {
      const diff = RISK_WEIGHTS[b.riskLevel] - RISK_WEIGHTS[a.riskLevel];
      if (diff !== 0) return diff;
      return b.count - a.count;
    });

    const rawToAggIdMap = new Map<string, string>();
    tier3Nodes.forEach((t3) => {
      t3.originalNodeIds.forEach((rawId) => rawToAggIdMap.set(rawId, t3.id));
    });

    // 4. TIER 1 AGGREGATION: Top N Systems
    const systemFindingCounts = new Map<
      string,
      {
        total: number;
        critical: number;
        high: number;
        med: number;
        low: number;
        findings: FindingItem[];
      }
    >();

    activeEdges.forEach((e) => {
      if (validSystemIds.has(e.from)) {
        if (!systemFindingCounts.has(e.from)) {
          systemFindingCounts.set(e.from, {
            total: 0,
            critical: 0,
            high: 0,
            med: 0,
            low: 0,
            findings: [],
          });
        }
        const stats = systemFindingCounts.get(e.from)!;
        stats.total += 1;
        if (e.riskLevel === 'critical') stats.critical += 1;
        else if (e.riskLevel === 'high') stats.high += 1;
        else if (e.riskLevel === 'medium') stats.med += 1;
        else stats.low += 1;

        const rawArt = rawNodeMap.get(e.to);
        if (rawArt) {
          const match = rawArt.description?.match(/in\s+([^\s:]+)(?::(\d+))?/);
          stats.findings.push({
            id: rawArt.id,
            name: rawArt.label,
            type: rawArt.type,
            riskLevel: rawArt.riskLevel as RiskLevel,
            path: match ? match[1] : rawArt.description || '',
            line: match && match[2] ? parseInt(match[2], 10) : null,
            description: rawArt.description,
          });
        }
      }
    });

    const scoredSystems = rawSystems.map((sys) => {
      const stats = systemFindingCounts.get(sys.id) || {
        total: 0,
        critical: 0,
        high: 0,
        med: 0,
        low: 0,
        findings: [],
      };
      const score =
        stats.critical * 1000 + stats.high * 100 + stats.med * 10 + stats.low * 1 + stats.total * 0.1;
      return { sys, stats, score };
    });

    const filteredScoredSystems = scoredSystems.filter(
      (item) => riskFilters[item.sys.riskLevel as RiskLevel] !== false
    );
    filteredScoredSystems.sort((a, b) => b.score - a.score);

    const tier1Nodes: AggregatedNode[] = [];
    const limit = topN === Infinity ? filteredScoredSystems.length : topN;
    const topSystems = filteredScoredSystems.slice(0, limit);
    const otherSystems = filteredScoredSystems.slice(limit);

    topSystems.forEach(({ sys, stats }) => {
      const label = sys.label.replace(/^Service:\s*/, '');
      tier1Nodes.push({
        id: sys.id,
        label,
        rawLabel: label,
        type: 'system',
        riskLevel: sys.riskLevel as RiskLevel,
        count: stats.total,
        description: sys.description || `Discovered system component containing ${stats.total} assets.`,
        originalNodeIds: [sys.id],
        findings: stats.findings,
        x: 260,
        y: 0,
        radius: Math.min(26, Math.max(16, 16 + Math.sqrt(stats.total) * 1.5)),
      });
      rawToAggIdMap.set(sys.id, sys.id);
    });

    if (otherSystems.length > 0 && !expandOtherSystems && topN !== Infinity) {
      const otherFindings = otherSystems.flatMap((item) => item.stats.findings);
      const otherRisk = otherSystems.reduce(
        (best, curr) =>
          RISK_WEIGHTS[curr.sys.riskLevel as RiskLevel] > RISK_WEIGHTS[best]
            ? (curr.sys.riskLevel as RiskLevel)
            : best,
        'none' as RiskLevel
      );
      const otherNode: AggregatedNode = {
        id: 'sys_group_other',
        label: `Other (${otherSystems.length} systems)`,
        rawLabel: `Other systems`,
        type: 'system',
        riskLevel: otherRisk,
        count: otherFindings.length,
        description: `Aggregated ${otherSystems.length} additional systems. Click to expand all.`,
        isGroup: true,
        originalNodeIds: otherSystems.map((item) => item.sys.id),
        findings: otherFindings,
        x: 260,
        y: 0,
        radius: 20,
      };
      tier1Nodes.push(otherNode);
      otherSystems.forEach((item) => rawToAggIdMap.set(item.sys.id, otherNode.id));
    } else if (otherSystems.length > 0 && expandOtherSystems) {
      otherSystems.forEach(({ sys, stats }) => {
        const label = sys.label.replace(/^Service:\s*/, '');
        tier1Nodes.push({
          id: sys.id,
          label,
          rawLabel: label,
          type: 'system',
          riskLevel: sys.riskLevel as RiskLevel,
          count: stats.total,
          description: sys.description || `Discovered system component containing ${stats.total} assets.`,
          originalNodeIds: [sys.id],
          findings: stats.findings,
          x: 260,
          y: 0,
          radius: Math.min(26, Math.max(16, 16 + Math.sqrt(stats.total) * 1.5)),
        });
        rawToAggIdMap.set(sys.id, sys.id);
      });
    }

    // 5. TIER 2 AGGREGATION: Libraries (if any)
    const tier2Nodes: AggregatedNode[] = [];
    if (rawLibraries.length > 0) {
      const libFindingCounts = new Map<string, { total: number; findings: FindingItem[] }>();
      activeEdges.forEach((e) => {
        if (validLibIds.has(e.from)) {
          if (!libFindingCounts.has(e.from)) {
            libFindingCounts.set(e.from, { total: 0, findings: [] });
          }
          const stats = libFindingCounts.get(e.from)!;
          stats.total += 1;
          const rawArt = rawNodeMap.get(e.to);
          if (rawArt) {
            const match = rawArt.description?.match(/in\s+([^\s:]+)(?::(\d+))?/);
            stats.findings.push({
              id: rawArt.id,
              name: rawArt.label,
              type: rawArt.type,
              riskLevel: rawArt.riskLevel as RiskLevel,
              path: match ? match[1] : rawArt.description || '',
              line: match && match[2] ? parseInt(match[2], 10) : null,
              description: rawArt.description,
            });
          }
        }
      });

      const scoredLibs = rawLibraries.map((lib) => {
        const stats = libFindingCounts.get(lib.id) || { total: 0, findings: [] };
        return { lib, stats };
      });
      const filteredScoredLibs = scoredLibs.filter(
        (item) => riskFilters[item.lib.riskLevel as RiskLevel] !== false
      );
      filteredScoredLibs.sort((a, b) => b.stats.total - a.stats.total);

      const topLibs = filteredScoredLibs.slice(0, limit);
      const otherLibs = filteredScoredLibs.slice(limit);

      topLibs.forEach(({ lib, stats }) => {
        tier2Nodes.push({
          id: lib.id,
          label: lib.label,
          rawLabel: lib.label,
          type: 'library',
          riskLevel: lib.riskLevel as RiskLevel,
          count: stats.total,
          description: lib.description || `Cryptographic library dependency.`,
          originalNodeIds: [lib.id],
          findings: stats.findings,
          x: 540,
          y: 0,
          radius: Math.min(26, Math.max(16, 16 + Math.sqrt(stats.total) * 1.5)),
        });
        rawToAggIdMap.set(lib.id, lib.id);
      });

      if (otherLibs.length > 0 && !expandOtherLibraries && topN !== Infinity) {
        const otherFindings = otherLibs.flatMap((item) => item.stats.findings);
        const otherRisk = otherLibs.reduce(
          (best, curr) =>
            RISK_WEIGHTS[curr.lib.riskLevel as RiskLevel] > RISK_WEIGHTS[best]
              ? (curr.lib.riskLevel as RiskLevel)
              : best,
          'none' as RiskLevel
        );
        const otherNode: AggregatedNode = {
          id: 'lib_group_other',
          label: `Other (${otherLibs.length} libraries)`,
          rawLabel: `Other libraries`,
          type: 'library',
          riskLevel: otherRisk,
          count: otherFindings.length,
          description: `Aggregated ${otherLibs.length} additional libraries. Click to expand all.`,
          isGroup: true,
          originalNodeIds: otherLibs.map((item) => item.lib.id),
          findings: otherFindings,
          x: 540,
          y: 0,
          radius: 20,
        };
        tier2Nodes.push(otherNode);
        otherLibs.forEach((item) => rawToAggIdMap.set(item.lib.id, otherNode.id));
      } else if (otherLibs.length > 0 && expandOtherLibraries) {
        otherLibs.forEach(({ lib, stats }) => {
          tier2Nodes.push({
            id: lib.id,
            label: lib.label,
            rawLabel: lib.label,
            type: 'library',
            riskLevel: lib.riskLevel as RiskLevel,
            count: stats.total,
            description: lib.description || `Cryptographic library dependency.`,
            originalNodeIds: [lib.id],
            findings: stats.findings,
            x: 540,
            y: 0,
            radius: Math.min(26, Math.max(16, 16 + Math.sqrt(stats.total) * 1.5)),
          });
          rawToAggIdMap.set(lib.id, lib.id);
        });
      }
    }

    // 6. POSITIONING Y COORDINATES EVENLY PER TIER
    const maxRows = Math.max(tier1Nodes.length, tier2Nodes.length, tier3Nodes.length, 3);
    const rowStep = Math.max(48, Math.min(72, 700 / maxRows));
    const paddingY = 60;
    const calculatedHeight = Math.max(540, paddingY * 2 + (maxRows - 1) * rowStep);

    const positionColumn = (nodes: AggregatedNode[]) => {
      const count = nodes.length;
      if (count === 0) return;
      if (count === 1) {
        nodes[0].y = calculatedHeight / 2;
        return;
      }
      const availableSpace = calculatedHeight - paddingY * 2;
      const step = availableSpace / (count - 1);
      nodes.forEach((n, idx) => {
        n.y = paddingY + idx * step;
      });
    };

    positionColumn(tier1Nodes);
    positionColumn(tier2Nodes);
    positionColumn(tier3Nodes);

    const allAggNodes = [...tier1Nodes, ...tier2Nodes, ...tier3Nodes];
    const visibleAggNodeIds = new Set(allAggNodes.map((n) => n.id));

    // 7. AGGREGATE EDGES
    const edgeMap = new Map<
      string,
      { from: string; to: string; count: number; riskLevels: RiskLevel[] }
    >();

    activeEdges.forEach((re) => {
      const aggFrom = rawToAggIdMap.get(re.from);
      const aggTo = rawToAggIdMap.get(re.to);

      if (
        aggFrom &&
        aggTo &&
        aggFrom !== aggTo &&
        visibleAggNodeIds.has(aggFrom) &&
        visibleAggNodeIds.has(aggTo)
      ) {
        const key = `${aggFrom}___${aggTo}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { from: aggFrom, to: aggTo, count: 0, riskLevels: [] });
        }
        const edgeEntry = edgeMap.get(key)!;
        edgeEntry.count += 1;
        edgeEntry.riskLevels.push(re.riskLevel as RiskLevel);
      }
    });

    const aggregatedEdges: AggregatedEdge[] = Array.from(edgeMap.entries()).map(([key, data]) => {
      const highestRisk = data.riskLevels.reduce(
        (best, curr) => (RISK_WEIGHTS[curr] > RISK_WEIGHTS[best] ? curr : best),
        'none' as RiskLevel
      );
      return {
        id: `agg_edge_${key}`,
        from: data.from,
        to: data.to,
        count: data.count,
        riskLevel: highestRisk,
      };
    });

    return {
      nodes: allAggNodes,
      edges: aggregatedEdges,
      virtualWidth: 1100,
      virtualHeight: calculatedHeight,
    };
  }, [
    rawNodes,
    rawEdges,
    includeTests,
    riskFilters,
    topN,
    expandOtherSystems,
    expandOtherLibraries,
  ]);

  // Default selection when nodes change
  useEffect(() => {
    if (visibleNodes.length > 0) {
      if (!selectedNodeId || !visibleNodes.some((n) => n.id === selectedNodeId)) {
        setSelectedNodeId(visibleNodes[0].id);
      }
    } else {
      setSelectedNodeId(null);
    }
  }, [visibleNodes, selectedNodeId]);

  // Selected node object
  const selectedNode = useMemo(
    () => visibleNodes.find((n) => n.id === selectedNodeId) || null,
    [selectedNodeId, visibleNodes]
  );

  // Derive connected nodes & edges for highlighting
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    const targetId = hoveredNodeId || selectedNodeId;
    if (!targetId) return { connectedNodeIds: new Set<string>(), connectedEdgeIds: new Set<string>() };

    const cEdges = new Set<string>();
    const cNodes = new Set<string>([targetId]);

    visibleEdges.forEach((e) => {
      if (e.from === targetId || e.to === targetId) {
        cEdges.add(e.id);
        cNodes.add(e.from);
        cNodes.add(e.to);
      }
    });

    return { connectedNodeIds: cNodes, connectedEdgeIds: cEdges };
  }, [hoveredNodeId, selectedNodeId, visibleEdges]);

  // Search match computation
  const searchMatchedNodeIds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    const matches = new Set<string>();
    visibleNodes.forEach((n) => {
      if (
        n.label.toLowerCase().includes(q) ||
        n.rawLabel.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.findings.some(
          (f) => f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
        )
      ) {
        matches.add(n.id);
      }
    });
    return matches;
  }, [searchQuery, visibleNodes]);

  // ==========================================================================
  // Zoom & Pan Viewport Helpers
  // ==========================================================================
  const fitToView = useCallback(() => {
    if (!graphContainerRef.current || visibleNodes.length === 0) return;
    const container = graphContainerRef.current;
    const containerWidth = container.clientWidth || 700;
    const containerHeight = container.clientHeight || 500;

    const padX = 30;
    const padTop = 52; // clears the 40px column tier header overlay
    const padBottom = 26;
    const availableHeight = Math.max(100, containerHeight - padTop - padBottom);

    const scaleX = (containerWidth - padX * 2) / virtualWidth;
    const scaleY = availableHeight / virtualHeight;
    const newScale = Math.min(1.15, Math.max(0.35, Math.min(scaleX, scaleY)));

    const contentWidth = virtualWidth * newScale;
    const contentHeight = virtualHeight * newScale;
    const newX = (containerWidth - contentWidth) / 2;
    const newY = padTop + (availableHeight - contentHeight) / 2;

    setTransform({ x: newX, y: newY, scale: newScale });
  }, [virtualWidth, virtualHeight, visibleNodes.length]);

  useEffect(() => {
    fitToView();
  }, [fitToView]);

  const handleZoomIn = () => {
    if (!graphContainerRef.current) return;
    const container = graphContainerRef.current;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const newScale = Math.min(4, transform.scale * 1.25);
    const newX = cx - (cx - transform.x) * (newScale / transform.scale);
    const newY = cy - (cy - transform.y) * (newScale / transform.scale);
    setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleZoomOut = () => {
    if (!graphContainerRef.current) return;
    const container = graphContainerRef.current;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const newScale = Math.max(0.2, transform.scale * 0.8);
    const newX = cx - (cx - transform.x) * (newScale / transform.scale);
    const newY = cy - (cy - transform.y) * (newScale / transform.scale);
    setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleResetZoom = () => {
    if (!graphContainerRef.current) return;
    const container = graphContainerRef.current;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const newX = cx - virtualWidth / 2;
    const newY = cy - virtualHeight / 2;
    setTransform({ x: newX, y: newY, scale: 1 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = graphContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.min(4, Math.max(0.2, transform.scale * factor));
    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      transX: transform.x,
      transY: transform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    setTransform((prev) => ({
      ...prev,
      x: panStartRef.current.transX + dx,
      y: panStartRef.current.transY + dy,
    }));
  };

  const handleMouseUp = () => setIsPanning(false);

  const toggleRiskFilter = (level: RiskLevel) => {
    setRiskFilters((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const resetAllFilters = () => {
    setRiskFilters({
      critical: true,
      high: true,
      medium: true,
      low: true,
      none: true,
    });
    setTopN(8);
    setIncludeTests(false);
    setSearchQuery('');
    setExpandOtherSystems(false);
    setExpandOtherLibraries(false);
  };

  const handleNodeClick = (node: AggregatedNode) => {
    if (node.isGroup) {
      if (node.id === 'sys_group_other') {
        setExpandOtherSystems(true);
      } else if (node.id === 'lib_group_other') {
        setExpandOtherLibraries(true);
      }
    }
    setSelectedNodeId(node.id);
  };

  return (
    <div className="relative min-h-screen bg-black text-slate-100 font-sans antialiased selection:bg-white/20 selection:text-white">
      {/* Background grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[linear-gradient(to_right,#21262d_1px,transparent_1px),linear-gradient(to_bottom,#21262d_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden="true"
      />
      {/* Ambient background glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10 flex flex-col gap-6">
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex flex-col gap-1">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              Risk Propagation Graph
            </h1>
            <p className="text-xs font-mono text-slate-400">
              Interactive 3-tier dependency hierarchy:{' '}
              <span className="text-slate-200">Systems → Libraries → Cryptographic Assets</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href={`/artefacts?scan_id=${scanId}`}>
              <button
                type="button"
                className="text-xs px-3.5 py-2 rounded-xl border border-white/20 bg-black/60 hover:bg-white/10 text-white font-medium transition-all"
              >
                Artefact Table
              </button>
            </Link>
            <Link href={`/reports?scan_id=${scanId}`}>
              <button
                type="button"
                className="text-xs px-3.5 py-2 rounded-xl bg-white text-black hover:bg-white/90 font-semibold shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all"
              >
                View Reports
              </button>
            </Link>
          </div>
        </header>

        {/* CONTROLS BAR ABOVE GRAPH */}
        <div className="bg-black/60 border border-white/15 rounded-2xl p-4 backdrop-blur-xl flex flex-col gap-4 shadow-[0_0_30px_-10px_rgba(255,255,255,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search Box */}
            <div className="relative min-w-[220px] max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes & findings..."
                className="w-full bg-black/80 border border-white/15 rounded-xl pl-9 pr-8 py-1.5 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/40 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Risk Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-white/50 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Risk:
              </span>
              {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
                const active = riskFilters[level];
                const col = RISK_COLOR_MAP[level];
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleRiskFilter(level)}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                      active
                        ? `${col.badgeBg} shadow-sm`
                        : 'border-white/10 bg-black/40 text-white/30 line-through opacity-60'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                    <span className="capitalize">{level}</span>
                  </button>
                );
              })}
            </div>

            {/* Top N Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-white/50 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Top N:
              </span>
              <div className="flex rounded-lg border border-white/10 bg-black/80 p-0.5 text-xs font-mono">
                {([5, 8, 15, Infinity] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTopN(n)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      topN === n
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-white/40 hover:text-white/80'
                    }`}
                  >
                    {n === Infinity ? 'All' : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Include Test / Vendored Code Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none border border-white/10 rounded-xl px-3 py-1.5 bg-black/60 hover:bg-white/5 transition-colors">
              <input
                type="checkbox"
                checked={includeTests}
                onChange={(e) => setIncludeTests(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/30 bg-black accent-white focus:ring-1 focus:ring-white/40"
              />
              <span className="text-[11px] font-mono text-white/70">
                Include test / vendored code
              </span>
            </label>
          </div>

          {/* Graph Legend Bar */}
          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-white/40 border-t border-white/10 pt-2 px-1">
            <div className="flex items-center gap-4">
              <span>
                <strong className="text-white/60">Node Size:</strong> Finding Count
              </span>
              <span>
                <strong className="text-white/60">Edge Width:</strong> Aggregated Connections
              </span>
              <span>
                <strong className="text-white/60">Color:</strong> Highest Risk Level
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-white/70">{visibleNodes.length}</strong> nodes,{' '}
                <strong className="text-white/70">{visibleEdges.length}</strong> aggregated edges
              </span>
              {(expandOtherSystems || expandOtherLibraries) && (
                <button
                  type="button"
                  onClick={() => {
                    setExpandOtherSystems(false);
                    setExpandOtherLibraries(false);
                  }}
                  className="text-amber-400 hover:text-amber-300 underline ml-2"
                >
                  Collapse &quot;Other&quot;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/40 text-center flex flex-col items-center gap-3">
            <div className="text-red-400 font-bold text-sm">Failed to Load Risk Graph</div>
            <p className="text-slate-300 text-xs font-mono max-w-lg">{error}</p>
            <button
              type="button"
              onClick={fetchGraph}
              className="text-xs px-4 py-2 mt-2 rounded-xl bg-white text-black font-semibold"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="p-16 rounded-2xl bg-black/60 border border-white/15 text-center flex flex-col items-center justify-center gap-3 font-mono text-xs text-slate-400 animate-pulse">
            <span className="h-3 w-3 rounded-full bg-white animate-ping" />
            <span>Constructing multi-tier cryptographic dependency topology...</span>
          </div>
        )}

        {/* EMPTY SCAN STATE */}
        {!loading && !error && rawNodes.length === 0 && (
          <div className="p-12 rounded-2xl bg-black/60 border border-white/15 text-center flex flex-col items-center gap-4">
            <h2 className="text-lg font-bold text-white">No Graph Nodes Available</h2>
            <p className="text-xs text-slate-400 max-w-md font-mono">
              The active scan has not detected any systems, libraries, or cryptographic primitives yet.
            </p>
            <Link href="/scan">
              <button
                type="button"
                className="text-xs px-5 py-2.5 rounded-xl bg-white text-black font-semibold"
              >
                Run a Scan
              </button>
            </Link>
          </div>
        )}

        {/* MAIN GRAPH CANVAS & DETAILS PANEL */}
        {!loading && !error && rawNodes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* SVG Graph Canvas Container (Span 8) */}
            <div
              ref={graphContainerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`lg:col-span-8 relative w-full h-[70vh] min-h-[520px] max-h-[750px] bg-black/70 border border-white/15 rounded-2xl overflow-hidden backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(255,255,255,0.08)] select-none ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {/* Column Tier Headers Overlay */}
              <div className="absolute inset-x-0 top-0 z-20 flex justify-between px-8 py-2.5 border-b border-white/10 bg-black/75 backdrop-blur-md font-mono text-[11px] uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1.5 w-1/3 text-left">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Tier 1: Systems &amp; Services
                </span>
                <span className="flex items-center justify-center gap-1.5 w-1/3 text-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Tier 2: Libraries &amp; Manifests
                </span>
                <span className="flex items-center justify-end gap-1.5 w-1/3 text-right">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Tier 3: Cryptographic Primitives
                </span>
              </div>

              {/* Floating Zoom / Pan Controls Toolbar */}
              <div className="absolute right-4 top-12 z-20 flex flex-col gap-1.5 bg-black/85 border border-white/15 rounded-xl p-1.5 backdrop-blur-md shadow-lg">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Zoom In (+)"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Zoom Out (-)"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <hr className="border-white/10 my-0.5" />
                <button
                  type="button"
                  onClick={fitToView}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Fit to View"
                  aria-label="Fit to View"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Reset Zoom (100%)"
                  aria-label="Reset Zoom"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              {/* Minimap (Bottom-Left) */}
              {visibleNodes.length > 0 && (
                <div
                  className="absolute left-4 bottom-4 z-20 w-[140px] h-[92px] bg-black/85 border border-white/20 rounded-xl p-1 backdrop-blur-md shadow-2xl pointer-events-none overflow-hidden"
                  aria-hidden="true"
                >
                  <div className="text-[9px] font-mono text-white/40 px-1 border-b border-white/10 pb-0.5 mb-1 flex items-center justify-between">
                    <span>MINIMAP</span>
                    <span>{Math.round(transform.scale * 100)}%</span>
                  </div>
                  <svg viewBox={`0 0 ${virtualWidth} ${virtualHeight}`} className="w-full h-[62px]">
                    {/* Mini Nodes */}
                    {visibleNodes.map((n) => {
                      const col = RISK_COLOR_MAP[n.riskLevel as RiskLevel] || RISK_COLOR_MAP.none;
                      return <circle key={n.id} cx={n.x} cy={n.y} r="8" fill={col.stroke} opacity="0.8" />;
                    })}

                    {/* Viewport Box */}
                    {graphContainerRef.current && (
                      <rect
                        x={-transform.x / transform.scale}
                        y={-transform.y / transform.scale}
                        width={graphContainerRef.current.clientWidth / transform.scale}
                        height={graphContainerRef.current.clientHeight / transform.scale}
                        fill="rgba(255,255,255,0.08)"
                        stroke="rgba(255,255,255,0.7)"
                        strokeWidth="3"
                        rx="4"
                      />
                    )}
                  </svg>
                </div>
              )}

              {/* EMPTY FILTER STATE */}
              {visibleNodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                  <ShieldAlert className="h-8 w-8 text-white/30 mb-2" />
                  <span className="text-sm font-semibold text-white">No Matching Graph Nodes</span>
                  <p className="text-xs text-white/50 font-mono mt-1 max-w-sm">
                    No nodes match your active risk filters or search query.
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="mt-4 text-xs px-4 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-mono transition-colors"
                  >
                    Reset all filters
                  </button>
                </div>
              )}

              {/* Main Interactive Zoomable/Pannable SVG Canvas */}
              <svg width="100%" height="100%" className="w-full h-full">
                <defs>
                  {/* Glowing filter for critical nodes */}
                  <filter id="glow-critical" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.6" />
                  </filter>
                  <filter id="glow-high" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.5" />
                  </filter>
                </defs>

                <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                  {/* 1. EDGES (Smooth Aggregated Cubic Beziers) */}
                  {visibleEdges.map((edge) => {
                    const source = visibleNodes.find((n) => n.id === edge.from);
                    const target = visibleNodes.find((n) => n.id === edge.to);
                    if (!source || !target) return null;

                    const isConnected = connectedEdgeIds.has(edge.id);
                    const isHoveredEdge = hoveredEdgeId === edge.id;
                    const hasActiveFocus = Boolean(selectedNodeId || hoveredNodeId);
                    const isDimmed = hasActiveFocus && !isConnected;

                    // Smooth horizontal cubic bezier curve strictly connecting node edges
                    const startX = source.x + source.radius;
                    const endX = target.x - target.radius;
                    const deltaX = endX - startX;
                    const cp1x = startX + deltaX * 0.5;
                    const cp1y = source.y;
                    const cp2x = endX - deltaX * 0.5;
                    const cp2y = target.y;

                    const pathData = `M ${startX} ${source.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${target.y}`;
                    const color = RISK_COLOR_MAP[edge.riskLevel as RiskLevel] || RISK_COLOR_MAP.none;

                    // Stroke width scaled logarithmically by count
                    const baseWidth = Math.min(5.5, Math.max(1.5, 1.2 + Math.log2(edge.count + 1) * 1.2));
                    const strokeWidth = isConnected || isHoveredEdge ? baseWidth + 1.5 : baseWidth;
                    const opacity = isDimmed ? 0.08 : isConnected || isHoveredEdge ? 1 : 0.26;

                    return (
                      <g
                        key={edge.id}
                        onMouseEnter={() => setHoveredEdgeId(edge.id)}
                        onMouseLeave={() => setHoveredEdgeId(null)}
                        className="transition-opacity duration-200 cursor-pointer"
                      >
                        <title>
                          {`${source.label} → ${target.label}: ${edge.count} connection${
                            edge.count === 1 ? '' : 's'
                          } (${edge.riskLevel} risk)`}
                        </title>
                        {/* Invisible thick path for easier hovering */}
                        <path d={pathData} fill="none" stroke="transparent" strokeWidth={Math.max(12, strokeWidth + 8)} />
                        {/* Rendered bezier stroke */}
                        <path
                          d={pathData}
                          fill="none"
                          stroke={color.stroke}
                          strokeWidth={strokeWidth}
                          strokeDasharray={edge.riskLevel === 'none' ? '4 4' : undefined}
                          opacity={opacity}
                          className="transition-all duration-200"
                        />
                      </g>
                    );
                  })}

                  {/* 2. NODES (Interactive Aggregated Circles) */}
                  {visibleNodes.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const isHovered = hoveredNodeId === node.id;
                    const isConnected = connectedNodeIds.has(node.id);
                    const hasActiveFocus = Boolean(selectedNodeId || hoveredNodeId);
                    const isDimmed = hasActiveFocus && !isConnected;

                    const isSearchMatch =
                      searchMatchedNodeIds === null ? true : searchMatchedNodeIds.has(node.id);
                    const finalDimmed = isDimmed || !isSearchMatch;

                    const colors = RISK_COLOR_MAP[node.riskLevel as RiskLevel] || RISK_COLOR_MAP.none;

                    // Label layout logic:
                    // Tier 1 (Systems): text to the left
                    // Tier 2 (Libraries): text centered below
                    // Tier 3 (Artefacts): text to the right
                    const isTier1 = node.type === 'system';
                    const isTier3 = node.type === 'artefact';

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={() => handleNodeClick(node)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className="cursor-pointer focus:outline-none transition-transform duration-150"
                        tabIndex={0}
                        role="button"
                        aria-label={`${node.label} (${node.type}) - ${node.count} findings`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleNodeClick(node);
                          }
                        }}
                      >
                        <title>
                          {`${node.label}\nCategory: ${node.type}\nFindings: ${node.count}\nHighest Risk: ${node.riskLevel}\n${
                            node.isGroup ? '(Click to expand in place)' : ''
                          }`}
                        </title>

                        {/* Soft Glow on Critical Nodes or Selected */}
                        {(isSelected || (node.riskLevel === 'critical' && !finalDimmed)) && (
                          <circle
                            r={node.radius + 7}
                            fill="none"
                            stroke={colors.stroke}
                            strokeWidth="1.5"
                            opacity={isSelected ? 0.8 : 0.35}
                            filter="url(#glow-critical)"
                            className={isSelected ? 'animate-pulse' : undefined}
                          />
                        )}

                        {/* Main Node Circle */}
                        <circle
                          r={node.radius}
                          fill="#090d16"
                          stroke={isSelected ? '#ffffff' : colors.stroke}
                          strokeWidth={isSelected ? 3 : node.isGroup ? 2 : 2}
                          strokeDasharray={node.isGroup ? '4 3' : undefined}
                          opacity={finalDimmed ? 0.15 : 1}
                          className="transition-colors duration-150"
                        />

                        {/* Finding Count or Type inside circle */}
                        <text
                          textAnchor="middle"
                          dy="3.5"
                          fill={isSelected ? '#ffffff' : colors.stroke}
                          fontSize={node.radius > 20 ? '11' : '9'}
                          fontFamily="monospace"
                          fontWeight="bold"
                          opacity={finalDimmed ? 0.25 : 1}
                          className="select-none"
                        >
                          {node.isGroup ? '+' : node.count > 0 ? node.count : '•'}
                        </text>

                        {/* Node Label Text */}
                        {isTier1 ? (
                          // Tier 1 (System): Render text to the LEFT
                          <g opacity={finalDimmed ? 0.2 : 1}>
                            <text
                              x={-node.radius - 8}
                              y="-2"
                              textAnchor="end"
                              fill="#f8fafc"
                              fontSize="11"
                              fontFamily="monospace"
                              fontWeight={isSelected ? 'bold' : '500'}
                              className="drop-shadow select-none"
                            >
                              {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                            </text>
                            <text
                              x={-node.radius - 8}
                              y="10"
                              textAnchor="end"
                              fill={colors.stroke}
                              fontSize="9"
                              fontFamily="monospace"
                              className="select-none uppercase font-semibold"
                            >
                              {node.isGroup ? 'Expand group' : `${node.count} findings`}
                            </text>
                          </g>
                        ) : isTier3 ? (
                          // Tier 3 (Artefact): Render text to the RIGHT
                          <g opacity={finalDimmed ? 0.2 : 1}>
                            <text
                              x={node.radius + 8}
                              y="-2"
                              textAnchor="start"
                              fill="#f8fafc"
                              fontSize="11"
                              fontFamily="monospace"
                              fontWeight={isSelected ? 'bold' : '500'}
                              className="drop-shadow select-none"
                            >
                              {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                            </text>
                            <text
                              x={node.radius + 8}
                              y="10"
                              textAnchor="start"
                              fill={colors.stroke}
                              fontSize="9"
                              fontFamily="monospace"
                              className="select-none uppercase font-semibold"
                            >
                              {node.riskLevel} risk
                            </text>
                          </g>
                        ) : (
                          // Tier 2 (Library): Render text centered below
                          <g opacity={finalDimmed ? 0.2 : 1}>
                            <text
                              x="0"
                              y={node.radius + 13}
                              textAnchor="middle"
                              fill="#f8fafc"
                              fontSize="10"
                              fontFamily="monospace"
                              fontWeight={isSelected ? 'bold' : '500'}
                              className="drop-shadow select-none"
                            >
                              {node.label.length > 18 ? `${node.label.slice(0, 16)}…` : node.label}
                            </text>
                            <text
                              x="0"
                              y={node.radius + 23}
                              textAnchor="middle"
                              fill={colors.stroke}
                              fontSize="9"
                              fontFamily="monospace"
                              className="select-none uppercase font-semibold"
                            >
                              {node.isGroup ? 'Expand group' : `${node.count} findings`}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* Sidebar Inspector Panel (Span 4) */}
            <div className="lg:col-span-4 bg-black/70 border border-white/15 rounded-2xl p-5 backdrop-blur-2xl flex flex-col gap-4 shadow-[0_0_50px_-12px_rgba(255,255,255,0.08)]">
              {selectedNode ? (
                <>
                  {/* Header Row */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                      Node Inspector
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                        (RISK_COLOR_MAP[selectedNode.riskLevel as RiskLevel] || RISK_COLOR_MAP.none).badgeBg
                      }`}
                    >
                      {selectedNode.riskLevel} Risk
                    </span>
                  </div>

                  {/* Node Identity */}
                  <div>
                    <h2
                      className="text-lg font-bold text-white tracking-tight flex items-center justify-between"
                      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                    >
                      <span className="truncate max-w-[240px]">{selectedNode.label}</span>
                      <span className="text-xs font-mono px-2 py-0.5 bg-white/10 text-white/80 rounded font-normal shrink-0">
                        {selectedNode.count} finding{selectedNode.count === 1 ? '' : 's'}
                      </span>
                    </h2>
                    <span className="text-xs font-mono text-slate-400 capitalize mt-0.5 block">
                      Category: {selectedNode.type}
                    </span>
                  </div>

                  {/* Description Box */}
                  <p className="text-xs text-slate-300 font-sans leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                    {selectedNode.description}
                  </p>

                  {/* Discovered Findings List */}
                  <div className="font-mono text-xs flex flex-col gap-2 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">
                        Discovered Assets ({selectedNode.findings.length})
                      </span>
                      <span className="text-[10px] text-white/40">Sorted by risk</span>
                    </div>

                    <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {selectedNode.findings.slice(0, 50).map((f) => {
                        const col = RISK_COLOR_MAP[f.riskLevel as RiskLevel] || RISK_COLOR_MAP.none;
                        return (
                          <li
                            key={f.id}
                            className="p-2 rounded bg-slate-900/80 border border-white/5 flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white font-medium text-[11px] truncate max-w-[190px]">
                                {f.name}
                              </span>
                              <span className={`text-[10px] font-semibold ${col.text} uppercase`}>
                                {f.riskLevel}
                              </span>
                            </div>
                            <span className="text-[10px] text-white/40 truncate" title={f.path}>
                              {f.path}
                              {f.line ? `:${f.line}` : ''}
                            </span>
                          </li>
                        );
                      })}
                      {selectedNode.findings.length > 50 && (
                        <li className="text-[10px] text-white/40 text-center py-1">
                          + {selectedNode.findings.length - 50} more findings
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Connected Topology Nodes */}
                  <div className="font-mono text-xs flex flex-col gap-2 pt-2 border-t border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">
                      Connected Topology Nodes ({connectedNodeIds.size - 1})
                    </span>

                    <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {Array.from(connectedNodeIds)
                        .filter((id) => id !== selectedNode.id)
                        .map((id) => {
                          const n = visibleNodes.find((item) => item.id === id);
                          if (!n) return null;
                          const color = RISK_COLOR_MAP[n.riskLevel as RiskLevel] || RISK_COLOR_MAP.none;
                          return (
                            <li
                              key={id}
                              onClick={() => setSelectedNodeId(id)}
                              className="p-1.5 rounded bg-slate-900/80 border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                            >
                              <span className="text-white truncate max-w-[170px] text-[11px]">
                                {n.label}
                              </span>
                              <span className={`text-[10px] font-semibold ${color.text} uppercase`}>
                                {n.riskLevel}
                              </span>
                            </li>
                          );
                        })}
                    </ul>
                  </div>

                  {/* Action Link to Artefact Table */}
                  <div className="pt-2">
                    <Link
                      href={`/artefacts?scan_id=${scanId}&search=${encodeURIComponent(
                        selectedNode.rawLabel
                      )}`}
                    >
                      <button
                        type="button"
                        className="w-full text-xs py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.25)] transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>View in Artefact Table</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-400 font-mono text-xs">
                  Click on any node in the canvas to inspect its propagation path.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RiskGraphPage() {
  return (
    <>
      <AppNav />
      <Suspense
        fallback={
          <div className="min-h-screen bg-black text-slate-400 font-mono text-xs flex items-center justify-center">
            Loading cryptographic dependency graph...
          </div>
        }
      >
        <RiskGraphContent />
      </Suspense>
    </>
  );
}