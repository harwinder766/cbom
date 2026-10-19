'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppNav from '@/app/components/navbar';
import { api, ArtefactItem, RiskLevel, BusinessCriticality, getActiveScanId, setActiveScanId } from '@/lib/api';

// ============================================================================
// Embedded Self-Contained UI Components (Guarantees zero-dependency compilation)
// ============================================================================

function Background({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative min-h-screen bg-black text-slate-100 font-sans antialiased selection:bg-white/20 selection:text-white ${className}`}>
      {/* Background grid overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[linear-gradient(to_right,#21262d_1px,transparent_1px),linear-gradient(to_bottom,#21262d_1px,transparent_1px)] bg-[size:48px_48px]" 
        aria-hidden="true" 
      />
      {/* Ambient background glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary';
}

function Button({ children, className = '', variant = 'default', ...props }: ButtonProps) {
  let baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:pointer-events-none disabled:opacity-50';

  let variantStyles = '';
  if (variant === 'default') {
    variantStyles =
      'bg-white text-black hover:bg-white/90 shadow-[0_0_25px_rgba(255,255,255,0.35)] hover:shadow-[0_0_35px_rgba(255,255,255,0.55)]';
  } else if (variant === 'outline') {
    variantStyles =
      'border border-white/20 bg-black/60 hover:bg-white/10 text-white backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)]';
  } else if (variant === 'secondary') {
    variantStyles = 'bg-slate-800 text-slate-100 hover:bg-slate-700';
  }

  return (
    <button className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      {children}
    </button>
  );
}

type SortKey = 'name' | 'type' | 'location' | 'algorithmClass' | 'riskLevel' | 'confidence';

// ============================================================================
// Main Client Page Component
// ============================================================================

function ArtefactsContent() {
  const searchParams = useSearchParams();
  const queryScanId = searchParams.get('scan_id');
  const [scanId, setScanId] = useState<string>('latest');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [quantumOnly, setQuantumOnly] = useState(false);

  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey>('riskLevel');
  const [sortAscending, setSortAscending] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const limit = 20;

  // Data & Loading state
  const [items, setItems] = useState<ArtefactItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Drawer state
  const [selectedArtefact, setSelectedArtefact] = useState<ArtefactItem | null>(null);

  // Inline Override state in Drawer
  const [overrideCriticality, setOverrideCriticality] = useState<BusinessCriticality>('medium');
  const [overrideShelfLife, setOverrideShelfLife] = useState<number>(5);
  const [overrideMigrationTime, setOverrideMigrationTime] = useState<number>(2);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  // Ref for focus trap management
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const resolvedId = queryScanId || getActiveScanId() || 'latest';
    setScanId(resolvedId);
    if (resolvedId && resolvedId !== 'latest') {
      setActiveScanId(resolvedId);
    }
  }, [queryScanId]);

  // Fetch Artefacts from Backend
  const fetchArtefacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getArtefacts(scanId, {
        search: searchTerm.trim() || undefined,
        riskLevel: riskFilter !== 'all' ? (riskFilter as RiskLevel) : undefined,
        type: typeFilter !== 'all' ? (typeFilter as any) : undefined,
        quantumOnly: quantumOnly ? true : undefined,
        sortBy: sortKey === 'riskLevel' ? 'riskLevel' : sortKey === 'name' ? 'name' : undefined,
        order: sortAscending ? 'asc' : 'desc',
        limit: limit,
        offset: (page - 1) * limit,
      });

      setItems(data.artefacts || (data as any).items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cryptographic artefacts.');
    } finally {
      setLoading(false);
    }
  }, [scanId, searchTerm, riskFilter, typeFilter, quantumOnly, sortKey, sortAscending, page]);

  useEffect(() => {
    fetchArtefacts();
  }, [fetchArtefacts]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, riskFilter, typeFilter, quantumOnly]);

  const isFiltered = searchTerm.trim() !== '' || riskFilter !== 'all' || typeFilter !== 'all' || quantumOnly;

  const clearFilters = () => {
    setSearchTerm('');
    setRiskFilter('all');
    setTypeFilter('all');
    setQuantumOnly(false);
    setPage(1);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAscending(!sortAscending);
    } else {
      setSortKey(key);
      setSortAscending(false);
    }
  };

  const openDrawer = (artefact: ArtefactItem, e: React.MouseEvent<HTMLTableRowElement> | React.KeyboardEvent<HTMLTableRowElement>) => {
    triggerRowRef.current = e.currentTarget as HTMLTableRowElement;
    setSelectedArtefact(artefact);
    setOverrideCriticality(artefact.businessCriticality || 'medium');
    setOverrideShelfLife(artefact.shelfLifeYears ?? 5);
    setOverrideMigrationTime(artefact.migrationTimeYears ?? 2);
    setUpdateSuccess(null);
  };

  const closeDrawer = () => {
    setSelectedArtefact(null);
    setUpdateSuccess(null);
    if (triggerRowRef.current) {
      triggerRowRef.current.focus();
    }
  };

  const handleSaveOverrides = async () => {
    if (!selectedArtefact) return;
    setIsUpdating(true);
    setUpdateSuccess(null);
    try {
      const updated = await api.updateArtefact(selectedArtefact.id, {
        businessCriticality: overrideCriticality,
        shelfLifeYears: Number(overrideShelfLife),
        migrationTimeYears: Number(overrideMigrationTime),
      });

      setSelectedArtefact(updated);
      setUpdateSuccess('Parameters updated & Mosca risk score recalculated!');
      fetchArtefacts(); // refresh table view
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Background>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col gap-8">
        
        {/* 1. TOP BAR */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-1">
            <h1
              className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              Cryptographic Artefacts
            </h1>
            <p className="text-xs font-mono text-slate-400">
              Active scan: <span className="text-slate-200 font-semibold">{scanId}</span> ·{' '}
              <span className="text-slate-200 font-semibold">{total} total assets discovered</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a href={`/reports?scan_id=${scanId}`}>
              <Button type="button" variant="outline" className="text-xs px-3.5 py-2 rounded-xl">
                Export CBOM
              </Button>
            </a>
            <a href="/scan">
              <Button type="button" className="text-xs px-4 py-2 rounded-xl">
                + New scan
              </Button>
            </a>
          </div>
        </header>

        {/* ERROR STATE */}
        {error && (
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/40 text-center flex flex-col items-center gap-3">
            <div className="text-red-400 font-bold text-sm">Failed to Load Artefacts</div>
            <p className="text-slate-300 text-xs font-mono max-w-lg">{error}</p>
            <Button onClick={fetchArtefacts} className="text-xs px-4 py-2 mt-2">
              Retry
            </Button>
          </div>
        )}

        {/* 2. FILTER & SEARCH CONTROLS */}
        <section className="bg-black/60 border border-white/15 rounded-2xl p-5 backdrop-blur-2xl flex flex-col gap-4 shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)]">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            
            {/* Search Input */}
            <div className="sm:col-span-4">
              <label htmlFor="artefact-search" className="sr-only">
                Search artefacts by name or path
              </label>
              <div className="relative">
                <input
                  id="artefact-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, cipher, or filepath..."
                  className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Risk Level Filter Dropdown */}
            <div className="sm:col-span-3">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
                aria-label="Filter by Risk Level"
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical Risk</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>

            {/* Artefact Type Filter Dropdown */}
            <div className="sm:col-span-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer capitalize"
                aria-label="Filter by Asset Type"
              >
                <option value="all">All Asset Types</option>
                <option value="algorithm">Algorithm</option>
                <option value="key">Key</option>
                <option value="certificate">Certificate</option>
                <option value="protocol">Protocol</option>
                <option value="library">Library</option>
                <option value="cloud_service">Cloud Service</option>
              </select>
            </div>

            {/* Quantum Vulnerable Toggle */}
            <div className="sm:col-span-2 flex items-center justify-start sm:justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={quantumOnly}
                  onChange={(e) => setQuantumOnly(e.target.checked)}
                  className="rounded border-white/30 bg-black accent-white focus:ring-white/40 h-3.5 w-3.5"
                />
                <span className="whitespace-nowrap">Quantum Only</span>
              </label>
            </div>

          </div>

          {/* Active Filter Clear Link */}
          {isFiltered && (
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs font-mono">
              <span className="text-slate-400 text-[11px]">
                Active filters applied
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-slate-300 hover:text-white underline decoration-white/30 text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-white rounded px-1"
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>

        {/* 3. TABLE SECTION */}
        <section className="bg-black/60 border border-white/15 rounded-2xl overflow-hidden backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-white/15 bg-black/80 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                  
                  {/* Column 1: Name */}
                  <th className="py-3.5 px-4 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-white transition-colors focus:outline-none"
                    >
                      <span>Artefact Name</span>
                      {sortKey === 'name' && (
                        <span>{sortAscending ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>

                  {/* Column 2: Type */}
                  <th className="py-3.5 px-4 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort('type')}
                      className="flex items-center gap-1 hover:text-white transition-colors focus:outline-none"
                    >
                      <span>Type</span>
                      {sortKey === 'type' && (
                        <span>{sortAscending ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>

                  {/* Column 3: Location */}
                  <th className="py-3.5 px-4 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort('location')}
                      className="flex items-center gap-1 hover:text-white transition-colors focus:outline-none"
                    >
                      <span>Location</span>
                      {sortKey === 'location' && (
                        <span>{sortAscending ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>

                  {/* Column 4: Algorithm Class */}
                  <th className="py-3.5 px-4 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort('algorithmClass')}
                      className="flex items-center gap-1 hover:text-white transition-colors focus:outline-none"
                    >
                      <span>Class</span>
                      {sortKey === 'algorithmClass' && (
                        <span>{sortAscending ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>

                  {/* Column 5: Risk Level */}
                  <th className="py-3.5 px-4 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort('riskLevel')}
                      className="flex items-center gap-1 hover:text-white transition-colors focus:outline-none"
                    >
                      <span>Risk Level</span>
                      {sortKey === 'riskLevel' && (
                        <span>{sortAscending ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>

                  {/* Column 6: Criticality */}
                  <th className="py-3.5 px-4 font-semibold hidden md:table-cell">
                    <span>Criticality</span>
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-white/5 font-mono">
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-mono text-xs">
                      <div className="flex items-center justify-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                        <span>Querying cryptographic inventory...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && items.length > 0 && (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      onClick={(e) => openDrawer(item, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDrawer(item, e);
                        }
                      }}
                      className="hover:bg-white/10 focus:bg-white/10 focus:outline-none transition-colors cursor-pointer group"
                    >
                      {/* Name & Quantum Badge */}
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span className="group-hover:text-white transition-colors">
                            {item.name}
                          </span>
                          {item.quantumVulnerable && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 uppercase font-semibold tracking-wide"
                              title="Quantum-vulnerable: Requires PQC migration"
                            >
                              PQ-VULN
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4 text-slate-400 capitalize">
                        {item.type.replace('_', ' ')}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 text-slate-300 truncate max-w-xs text-[11px]">
                        {item.location ? `${item.location.path}${item.location.line ? `:${item.location.line}` : ''}` : 'N/A'}
                      </td>

                      {/* Algorithm Class */}
                      <td className="py-3.5 px-4 text-slate-400 capitalize">
                        {item.algorithmClass}
                      </td>

                      {/* Risk Level Badge */}
                      <td className="py-3.5 px-4">
                        {item.riskLevel === 'critical' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-950/80 text-red-300 border border-red-800/60">
                            CRITICAL
                          </span>
                        )}
                        {item.riskLevel === 'high' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                            HIGH
                          </span>
                        )}
                        {item.riskLevel === 'medium' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
                            MEDIUM
                          </span>
                        )}
                        {item.riskLevel === 'low' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            LOW
                          </span>
                        )}
                      </td>

                      {/* Criticality */}
                      <td className="py-3.5 px-4 text-slate-300 uppercase text-[11px] hidden md:table-cell">
                        <span className={`px-2 py-0.5 rounded border text-[10px] ${
                          item.businessCriticality === 'critical'
                            ? 'bg-red-900/30 border-red-500/40 text-red-300'
                            : item.businessCriticality === 'high'
                            ? 'bg-amber-900/30 border-amber-500/40 text-amber-300'
                            : 'bg-slate-900 border-white/10 text-slate-400'
                        }`}>
                          {item.businessCriticality}
                        </span>
                      </td>

                    </tr>
                  ))
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-mono text-xs">
                      No cryptographic artefacts match your active filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 border-t border-white/10 text-xs font-mono text-slate-400">
            <span>
              Showing {items.length} of {total} findings (Page {page} of {totalPages})
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-[11px] px-3 py-1 rounded-lg"
              >
                ← Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-[11px] px-3 py-1 rounded-lg"
              >
                Next →
              </Button>
            </div>
          </div>
        </section>

      </div>

      {/* 4. DETAIL DRAWER (SLIDE-OVER OVERLAY) */}
      {selectedArtefact && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Semi-transparent backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Details for ${selectedArtefact.name}`}
            className="relative z-10 w-full max-w-lg bg-black/95 border-l border-white/15 p-6 md:p-8 flex flex-col justify-between overflow-y-auto shadow-2xl h-full backdrop-blur-2xl"
          >
            {/* Top Bar: Close Button */}
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Artefact Details & Risk Assessment
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDrawer}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  aria-label="Close drawer"
                >
                  ✕ Close
                </Button>
              </div>

              {/* Title & Risk Badge */}
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex items-center justify-between">
                  <h2
                    className="text-2xl font-bold text-white tracking-tight"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    {selectedArtefact.name}
                  </h2>
                  
                  {selectedArtefact.riskLevel === 'critical' && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-red-950/80 text-red-300 border border-red-800/60">
                      CRITICAL RISK
                    </span>
                  )}
                  {selectedArtefact.riskLevel === 'high' && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                      HIGH RISK
                    </span>
                  )}
                  {selectedArtefact.riskLevel === 'medium' && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
                      MEDIUM RISK
                    </span>
                  )}
                  {selectedArtefact.riskLevel === 'low' && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      LOW RISK
                    </span>
                  )}
                </div>

                {selectedArtefact.quantumVulnerable && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 font-mono text-xs flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span>Quantum-Vulnerable (Shor's Algorithm Exposure)</span>
                  </div>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="space-y-4 font-mono text-xs">
                {/* Location */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col gap-1">
                  <span className="text-[10px] uppercase text-slate-500 font-semibold">Location / Path</span>
                  <span className="text-white text-xs break-all">
                    {selectedArtefact.location.path}
                    {selectedArtefact.location.line && `:${selectedArtefact.location.line}`}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    Origin: {selectedArtefact.location.source} layer
                  </span>
                </div>

                {/* Class & Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Asset Type</span>
                    <span className="text-white capitalize">{selectedArtefact.type.replace('_', ' ')}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Algorithm Class</span>
                    <span className="text-white capitalize">{selectedArtefact.algorithmClass}</span>
                  </div>
                </div>

                {/* Detection Method & Confidence */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Detection Engine</span>
                    <span className="text-white">{selectedArtefact.detectionMethod}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Confidence Score</span>
                    <span className="text-slate-200 font-bold">{Math.round(selectedArtefact.confidence * 100)}%</span>
                  </div>
                </div>

                {/* INLINE RISK & CRITICALITY OVERRIDE PANEL (MOSCA X + Y > Z) */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-white/20 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Mosca Parameters & Criticality Override
                    </span>
                    <span className="text-[10px] text-slate-400">X + Y &gt; Z</span>
                  </div>

                  {updateSuccess && (
                    <div className="p-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px]">
                      ✓ {updateSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Criticality</label>
                      <select
                        value={overrideCriticality}
                        onChange={(e) => setOverrideCriticality(e.target.value as BusinessCriticality)}
                        className="w-full bg-black border border-white/20 rounded px-2 py-1.5 text-white capitalize text-xs"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Shelf Life (X yrs)</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={overrideShelfLife}
                        onChange={(e) => setOverrideShelfLife(Number(e.target.value))}
                        className="w-full bg-black border border-white/20 rounded px-2 py-1 text-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Migr Time (Y yrs)</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={overrideMigrationTime}
                        onChange={(e) => setOverrideMigrationTime(Number(e.target.value))}
                        className="w-full bg-black border border-white/20 rounded px-2 py-1 text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-slate-300 pt-1">
                    <span>Mosca Inequality Status: </span>
                    {overrideShelfLife + overrideMigrationTime > (selectedArtefact.quantumHorizonYears || 7) ? (
                      <span className="text-red-400 font-bold">
                        VIOLATED ({overrideShelfLife} + {overrideMigrationTime} = {overrideShelfLife + overrideMigrationTime} &gt; {selectedArtefact.quantumHorizonYears || 7} yrs to Q-Day)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold">
                        SATISFIED ({overrideShelfLife} + {overrideMigrationTime} &lt;= {selectedArtefact.quantumHorizonYears || 7} yrs)
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={handleSaveOverrides}
                    disabled={isUpdating}
                    className="text-xs py-2 mt-1 rounded-lg"
                  >
                    {isUpdating ? 'Recalculating...' : 'Update & Recalculate Risk'}
                  </Button>
                </div>

                {/* PQC Recommendation Panel */}
                {selectedArtefact.recommendation ? (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/20 flex flex-col gap-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      NIST PQC Migration Path
                    </span>

                    <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                      <span>Recommended Replacement:</span>
                      <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 text-emerald-300">
                        {selectedArtefact.recommendation.replacement}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-slate-300 pt-2 border-t border-white/10 leading-relaxed font-sans">
                      <p>
                        <strong className="font-mono text-slate-200">Latency Note:</strong>{' '}
                        {selectedArtefact.recommendation.latencyNote}
                      </p>
                      <p>
                        <strong className="font-mono text-slate-200">Cost / Payload Note:</strong>{' '}
                        {selectedArtefact.recommendation.costNote}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 text-slate-400 text-xs font-sans">
                    Symmetric or cryptographic primitive does not require immediate post-quantum replacement. Ensure key sizes meet Grover mitigation thresholds (AES-256 / SHA-384).
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t border-white/10 mt-6 flex justify-between items-center">
              <span className="font-mono text-[10px] text-slate-500">ID: {selectedArtefact.id}</span>
              <Button
                type="button"
                onClick={closeDrawer}
                className="text-xs px-5 py-2.5 rounded-xl"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </Background>
  );
}

export default function ArtefactsPage() {
  return (
    <>
      <AppNav />
      <Suspense fallback={
        <Background>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-slate-400 font-mono text-xs animate-pulse">
            Loading cryptographic inventory...
          </div>
        </Background>
      }>
        <ArtefactsContent />
      </Suspense>
    </>
  );
}