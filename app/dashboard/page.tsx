'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AppNav from '@/app/components/navbar';
import { api, DashboardMetricsResponse, getActiveScanId, setActiveScanId } from '@/lib/api';

// ============================================================================
// Self-Contained UI Primitives (Guarantees zero-dependency compilation)
// ============================================================================

function Background({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative min-h-screen bg-black text-slate-100 font-sans antialiased selection:bg-white/20 selection:text-white ${className}`}>
      {/* Subtle background grid pattern */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[linear-gradient(to_right,#21262d_1px,transparent_1px),linear-gradient(to_bottom,#21262d_1px,transparent_1px)] bg-[size:48px_48px]" 
        aria-hidden="true" 
      />
      {/* Ambient glass glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary';
  asChild?: boolean;
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

function DashboardContent() {
  const searchParams = useSearchParams();
  const queryScanId = searchParams.get('scan_id');
  const [scanId, setScanId] = useState<string>('latest');
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolvedId = queryScanId || getActiveScanId() || 'latest';
    setScanId(resolvedId);
    if (resolvedId && resolvedId !== 'latest') {
      setActiveScanId(resolvedId);
    }
  }, [queryScanId]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboardMetrics(scanId);
      setMetrics(data);
      if (data.scanMetadata?.id) {
        setActiveScanId(data.scanMetadata.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Derive aggregate metrics
  const totalArtefacts = metrics?.totalArtefacts ?? 0;
  const criticalCount = metrics?.criticalCount ?? metrics?.criticalFindings ?? 0;
  const highCount = metrics?.highCount ?? metrics?.highFindings ?? 0;
  const mediumCount = metrics?.mediumCount ?? metrics?.riskDistribution?.medium ?? 0;
  const lowCount = metrics?.lowCount ?? metrics?.riskDistribution?.low ?? 0;
  const quantumVulnerableCount = metrics?.quantumVulnerableCount ?? metrics?.quantumVulnerable ?? 0;
  const symmetricCount = metrics?.symmetricCount ?? metrics?.classExposure?.symmetric ?? 0;
  const hashCount = metrics?.hashCount ?? metrics?.classExposure?.hash ?? 0;

  const totalForPct = totalArtefacts > 0 ? totalArtefacts : 1;
  const criticalPct = metrics?.criticalPct ?? Math.round((criticalCount / totalForPct) * 100);
  const highPct = metrics?.highPct ?? Math.round((highCount / totalForPct) * 100);
  const mediumPct = metrics?.mediumPct ?? Math.round((mediumCount / totalForPct) * 100);
  const lowPct = metrics?.lowPct ?? Math.round((lowCount / totalForPct) * 100);

  const recentFindings = metrics?.recentFindings ?? metrics?.topFindings ?? [];
  const targetName = metrics?.scanMetadata?.target || metrics?.scanId || 'Current Target';

  return (
    <Background>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col gap-10">
        
        {/* 1. TOP BAR */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-1">
            <h1
              className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              Dashboard
            </h1>
            <p className="text-xs font-mono text-slate-400">
              Target: <span className="text-slate-200 font-semibold">{targetName}</span> ·{' '}
              <span className="text-slate-200 font-semibold">{totalArtefacts} total artefacts</span> evaluated
            </p>
          </div>

          <a href="/scan" className="self-start sm:self-auto">
            <Button type="button" className="text-xs px-4 py-2.5 rounded-xl">
              + New scan
            </Button>
          </a>
        </header>

        {/* ERROR STATE */}
        {error && (
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/40 text-center flex flex-col items-center gap-3">
            <div className="text-red-400 font-bold text-sm">Backend Service Unavailable</div>
            <p className="text-slate-300 text-xs font-mono max-w-lg">{error}</p>
            <Button onClick={fetchMetrics} className="text-xs px-4 py-2 mt-2">
              Retry Connection
            </Button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && totalArtefacts === 0 && (
          <div className="p-12 rounded-2xl bg-black/60 border border-white/15 text-center flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white text-xl">
              🔍
            </div>
            <h2 className="text-lg font-bold text-white">No Cryptographic Scans Performed Yet</h2>
            <p className="text-xs text-slate-400 max-w-md">
              Start by scanning a local folder, GitHub repository, or container image to generate your Cryptographic Bill of Materials (CBOM).
            </p>
            <a href="/scan">
              <Button type="button" className="text-xs px-5 py-2.5 rounded-xl mt-2">
                Launch First Scan
              </Button>
            </a>
          </div>
        )}

        {/* LOADING SKELETON */}
        {loading && (
          <div className="animate-pulse flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-5 h-64 bg-white/5 rounded-2xl border border-white/10" />
              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="h-64 bg-white/5 rounded-2xl border border-white/10" />
                <div className="h-64 bg-white/5 rounded-2xl border border-white/10" />
                <div className="h-64 bg-white/5 rounded-2xl border border-white/10" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-56 bg-white/5 rounded-2xl border border-white/10" />
              <div className="h-56 bg-white/5 rounded-2xl border border-white/10" />
            </div>
          </div>
        )}

        {/* METRICS & CHARTS CONTENT */}
        {!loading && !error && totalArtefacts > 0 && (
          <>
            {/* 2. SUMMARY CARDS ROW (Asymmetric Sizing) */}
            <section className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Large Primary Card (Span 5) */}
              <div className="md:col-span-5 bg-black/60 border border-white/15 rounded-2xl p-6 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)] flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-slate-400 uppercase tracking-wider font-semibold">
                      CRYPTOGRAPHIC INVENTORY
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">
                      CYCLONEDX 1.6
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Total detected keys, algorithms, & certificates</p>
                </div>

                <div className="my-6">
                  <div
                    className="text-5xl sm:text-6xl font-bold text-white tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    {totalArtefacts}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-2">
                    Evaluated across repository filesystem & dependencies
                  </p>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-red-400">{criticalPct}% Critical Exposure</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-amber-400">{highPct}% High Risk</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">{lowPct + mediumPct}% Standard</span>
                </div>
              </div>

              {/* Three Smaller Cards (Span 7 - Grid of 3) */}
              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Critical Count Card */}
                <div className="bg-black/60 border border-red-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-[0_0_30px_rgba(239,68,68,0.1)] flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-red-400 font-semibold uppercase tracking-wider">
                      Critical
                    </span>
                    <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  </div>
                  <div
                    className="text-4xl font-bold text-white my-1"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    {criticalCount}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Immediate Shor's algorithm breakdown risk
                  </p>
                </div>

                {/* High Count Card */}
                <div className="bg-black/60 border border-amber-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-[0_0_30px_rgba(245,158,11,0.1)] flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-amber-400 font-semibold uppercase tracking-wider">
                      High Risk
                    </span>
                    <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                  </div>
                  <div
                    className="text-4xl font-bold text-white my-1"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    {highCount}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Deprecated hashes or short key lengths
                  </p>
                </div>

                {/* Quantum-Vulnerable Card */}
                <div className="bg-black/60 border border-white/20 rounded-2xl p-5 backdrop-blur-xl shadow-[0_0_30px_rgba(255,255,255,0.05)] flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-white font-semibold uppercase tracking-wider">
                      Quantum-Vuln
                    </span>
                    <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
                  </div>
                  <div
                    className="text-4xl font-bold text-white my-1"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    {quantumVulnerableCount}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Asymmetric primitives requiring PQC migration
                  </p>
                </div>
              </div>
            </section>

            {/* 3. RISK BREAKDOWN CHARTS */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chart 1: Risk Level Distribution (Horizontal Stacked / Segment Bar) */}
              <div className="bg-black/60 border border-white/15 rounded-2xl p-6 backdrop-blur-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h2
                      className="text-lg font-bold text-white"
                      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                    >
                      Risk Level Breakdown
                    </h2>
                    <span className="text-xs font-mono text-slate-400">{totalArtefacts} total</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">Categorized via Mosca's inequality weighting</p>

                  {/* Segmented Horizontal Bar */}
                  <div className="w-full h-4 bg-slate-900 rounded-lg overflow-hidden flex border border-white/10 p-0.5 gap-0.5 my-4">
                    <div
                      style={{ width: `${criticalPct}%` }}
                      className="bg-red-500 h-full rounded-l transition-all shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                      title={`Critical: ${criticalCount}`}
                    />
                    <div
                      style={{ width: `${highPct}%` }}
                      className="bg-amber-400 h-full transition-all shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                      title={`High: ${highCount}`}
                    />
                    <div
                      style={{ width: `${mediumPct}%` }}
                      className="bg-blue-400 h-full transition-all"
                      title={`Medium: ${mediumCount}`}
                    />
                    <div
                      style={{ width: `${lowPct}%` }}
                      className="bg-slate-500 h-full rounded-r transition-all"
                      title={`Low: ${lowCount}`}
                    />
                  </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10 font-mono text-xs">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-red-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span>Critical ({criticalCount})</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{criticalPct}%</span>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span>High ({highCount})</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{highPct}%</span>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-blue-400" />
                      <span>Medium ({mediumCount})</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{mediumPct}%</span>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-slate-500" />
                      <span>Low ({lowCount})</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{lowPct}%</span>
                  </div>
                </div>
              </div>

              {/* Chart 2: Risk-by-Type / Algorithm Class */}
              <div className="bg-black/60 border border-white/15 rounded-2xl p-6 backdrop-blur-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h2
                      className="text-lg font-bold text-white"
                      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                    >
                      Cryptographic Class Exposure
                    </h2>
                    <span className="text-xs font-mono text-slate-400">PQC Threat Matrix</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">Asymmetric vs Symmetric vs Hashing algorithms</p>

                  {/* Grouped Bar Bars */}
                  <div className="space-y-3 font-mono text-xs">
                    {/* Asymmetric Bar */}
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="font-semibold text-white">Asymmetric (Shor's Threat)</span>
                        <span>{quantumVulnerableCount} ({Math.round((quantumVulnerableCount / totalForPct) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/10">
                        <div
                          style={{ width: `${(quantumVulnerableCount / totalForPct) * 100}%` }}
                          className="bg-white h-full rounded-full shadow-[0_0_8px_#ffffff]"
                        />
                      </div>
                    </div>

                    {/* Symmetric Bar */}
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Symmetric (Grover's Weakened)</span>
                        <span>{symmetricCount} ({Math.round((symmetricCount / totalForPct) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/10">
                        <div
                          style={{ width: `${(symmetricCount / totalForPct) * 100}%` }}
                          className="bg-slate-400 h-full rounded-full"
                        />
                      </div>
                    </div>

                    {/* Hash Bar */}
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Hashing Primitives</span>
                        <span>{hashCount} ({Math.round((hashCount / totalForPct) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/10">
                        <div
                          style={{ width: `${(hashCount / totalForPct) * 100}%` }}
                          className="bg-slate-600 h-full rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-4 border-t border-white/10 mt-4 leading-relaxed">
                  *Asymmetric primitives require immediate replacement with NIST ML-KEM / ML-DSA standards.
                </p>
              </div>
            </section>

            {/* 4. QUICK NAV ROW */}
            <section className="flex flex-col gap-3">
              <h2
                className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold"
              >
                Quick Navigation & Analytics
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Link Card 1 */}
                <a
                  href={`/artefacts?scan_id=${scanId}`}
                  className="p-4 bg-black/60 border border-white/15 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all group flex flex-col gap-1 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-sm text-white group-hover:text-white transition-colors"
                      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                    >
                      View all artefacts →
                    </span>
                    <span className="font-mono text-xs text-slate-500">{totalArtefacts} items</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">
                    Filter and inspect all detected algorithms, keys, and certificates.
                  </p>
                </a>

                {/* Link Card 2 */}
                <a
                  href={`/risk-graph?scan_id=${scanId}`}
                  className="p-4 bg-black/60 border border-white/15 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all group flex flex-col gap-1 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-sm text-white group-hover:text-white transition-colors"
                      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                    >
                      View risk graph →
                    </span>
                    <span className="font-mono text-xs text-slate-500">Dependency tree</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">
                    Map call graphs and trace crypto propagation across microservices.
                  </p>
                </a>

                {/* Link Card 3 */}
                <a
                  href={`/reports?scan_id=${scanId}`}
                  className="p-4 bg-black/60 border border-white/15 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all group flex flex-col gap-1 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-sm text-white group-hover:text-white transition-colors"
                      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                    >
                      View reports →
                    </span>
                    <span className="font-mono text-xs text-slate-500">CycloneDX CBOM</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">
                    Export executive PDFs and standardized machine-readable manifests.
                  </p>
                </a>
              </div>
            </section>

            {/* 5. RECENT FINDINGS PREVIEW */}
            <section className="bg-black/60 border border-white/15 rounded-2xl p-6 backdrop-blur-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2
                    className="text-lg font-bold text-white"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    Top Vulnerable Findings
                  </h2>
                  <p className="text-xs text-slate-400">Highest-priority cryptographic migration candidates</p>
                </div>

                <a
                  href={`/artefacts?scan_id=${scanId}`}
                  className="text-xs font-mono text-slate-300 hover:text-white transition-colors underline decoration-white/30"
                >
                  View all →
                </a>
              </div>

              {/* Compact Preview Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Artefact Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Risk Level</th>
                      <th className="py-2.5 px-3">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {recentFindings.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        {/* Name */}
                        <td className="py-3 px-3 font-semibold text-white">
                          {item.name}
                        </td>

                        {/* Type */}
                        <td className="py-3 px-3 text-slate-400 capitalize">
                          {item.type.replace('_', ' ')}
                        </td>

                        {/* Risk Level Badge */}
                        <td className="py-3 px-3">
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

                        {/* Location String */}
                        <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-xs">
                          {typeof item.location === 'string'
                            ? item.location
                            : item.location
                            ? `${item.location.path}${item.location.line ? `:${item.location.line}` : ''}`
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 text-right">
                <a
                  href={`/artefacts?scan_id=${scanId}`}
                  className="text-xs font-mono text-slate-400 hover:text-white transition-colors"
                >
                  Showing {recentFindings.length} of {totalArtefacts} total findings · View full inventory →
                </a>
              </div>
            </section>
          </>
        )}

        {/* FOOTER */}
        <footer className="flex items-center justify-between text-xs font-mono text-slate-500 pt-4 border-t border-white/10">
          <span>CBOM ASSESSMENT ENGINE v1.4.2</span>
          <span>SCAN ID: {scanId}</span>
        </footer>

      </div>
    </Background>
  );
}

export default function DashboardPage() {
  return (
    <>
      <AppNav />
      <Suspense fallback={
        <Background>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-slate-400 font-mono text-xs animate-pulse">
            Loading dashboard telemetry...
          </div>
        </Background>
      }>
        <DashboardContent />
      </Suspense>
    </>
  );
}