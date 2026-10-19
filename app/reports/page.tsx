'use client';

import React, { useState, useMemo, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AppNav from '@/app/components/navbar';
import { api, ReportsSummaryResponse, ReportArtefactItem, getActiveScanId, setActiveScanId, API_BASE } from '@/lib/api';

// ============================================================================
// Self-Contained UI Primitives (Guarantees zero-dependency compilation)
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

// ============================================================================
// Main Page Component
// ============================================================================

function ReportsContent() {
  const searchParams = useSearchParams();
  const queryScanId = searchParams.get('scan_id');
  const [scanId, setScanId] = useState<string>('latest');

  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<ReportsSummaryResponse | null>(null);
  const [rawCbomJson, setRawCbomJson] = useState<string>('{\n  "status": "Loading CBOM manifest..."\n}');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolvedId = queryScanId || getActiveScanId() || 'latest';
    setScanId(resolvedId);
    if (resolvedId && resolvedId !== 'latest') {
      setActiveScanId(resolvedId);
    }
  }, [queryScanId]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryData = await api.getReportsSummary(scanId);
      setSummary(summaryData);

      // Fetch actual raw CycloneDX 1.6 JSON manifest
      try {
        const cdxRes = await fetch(`${API_BASE}/api/scans/${scanId}/report?format=cbom`);
        if (cdxRes.ok) {
          const cdxJson = await cdxRes.json();
          setRawCbomJson(JSON.stringify(cdxJson, null, 2));
        }
      } catch {
        // keep fallback
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report summary.');
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Group artefacts into Quantum Risk vs Legacy Risk
  const quantumRiskItems = useMemo(
    () => summary?.quantumRiskItems || [],
    [summary]
  );

  const legacyRiskItems = useMemo(
    () => summary?.legacyRiskItems || [],
    [summary]
  );

  // Trigger file download helper
  const handleDownload = (format: 'cbom' | 'csv' | 'pdf' | 'html') => {
    const url = api.getReportDownloadUrl(scanId, format);
    const link = document.createElement('a');
    link.href = url;
    if (format === 'html') {
      link.target = '_blank';
    } else {
      link.setAttribute('download', '');
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy JSON to clipboard
  const handleCopyClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(rawCbomJson);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = rawCbomJson;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  return (
    <Background>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col gap-10">
        
        {/* 1. HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-1">
            <h1
              className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              Reports &amp; Export
            </h1>
            <p className="text-xs font-mono text-slate-400 max-w-2xl leading-relaxed">
              Generate and download standardized CycloneDX 1.6 Cryptographic Bill of Materials (CBOM) manifests and NIST PQC migration plans. Active scan: <span className="text-slate-200">{scanId}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownload('pdf')}
              className="text-xs px-3.5 py-2 rounded-xl text-red-300 hover:text-white"
            >
              ↓ PDF Report
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownload('csv')}
              className="text-xs px-3.5 py-2 rounded-xl text-emerald-300 hover:text-white"
            >
              ↓ CSV Export
            </Button>
            <Button
              type="button"
              onClick={() => handleDownload('cbom')}
              className="text-xs px-4 py-2 rounded-xl"
            >
              ↓ CBOM JSON
            </Button>
          </div>
        </header>

        {/* ERROR STATE */}
        {error && (
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/40 text-center flex flex-col items-center gap-3">
            <div className="text-red-400 font-bold text-sm">Failed to Load Report Data</div>
            <p className="text-slate-300 text-xs font-mono max-w-lg">{error}</p>
            <Button onClick={fetchReportData} className="text-xs px-4 py-2 mt-2">
              Retry Connection
            </Button>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="p-16 rounded-2xl bg-black/60 border border-white/15 text-center flex flex-col items-center justify-center gap-3 font-mono text-xs text-slate-400 animate-pulse">
            <span className="h-3 w-3 rounded-full bg-white animate-ping" />
            <span>Compiling CycloneDX 1.6 CBOM and NIST PQC migration roadmap...</span>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && quantumRiskItems.length === 0 && legacyRiskItems.length === 0 && (
          <div className="p-12 rounded-2xl bg-black/60 border border-white/15 text-center flex flex-col items-center gap-4">
            <h2 className="text-lg font-bold text-white">No Cryptographic Findings in Active Scan</h2>
            <p className="text-xs text-slate-400 max-w-md font-mono">
              Scan a target repository to generate cryptographic discovery reports and post-quantum roadmaps.
            </p>
            <a href="/scan">
              <Button type="button" className="text-xs px-5 py-2.5 rounded-xl">
                Start a New Scan
              </Button>
            </a>
          </div>
        )}

        {/* REPORT CONTENT */}
        {!loading && !error && (quantumRiskItems.length > 0 || legacyRiskItems.length > 0) && (
          <>
            {/* 2. PQC RECOMMENDATION SUMMARY */}
            <section className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h2
                  className="text-xl font-bold text-white tracking-tight"
                  style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                >
                  Cryptographic Migration Roadmap
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  Direct mapping from legacy classical primitives to NIST Post-Quantum Cryptography (PQC) standards.
                </p>
              </div>

              {/* Group 1: Quantum Risk Items */}
              <div className="bg-black/60 border border-white/15 rounded-2xl p-6 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)] flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                    <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                      Post-Quantum Risk Items (Shor's Algorithm Exposure)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {quantumRiskItems.length} vulnerable assets
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Asymmetric key agreement, signatures, and public-key infrastructure. Adversaries can record traffic today and decrypt retroactively when a quantum computer arrives.
                </p>

                <div className="space-y-4">
                  {quantumRiskItems.map((item) => (
                    <div
                      key={item.artefactId}
                      className="p-4 rounded-xl bg-black/80 border border-white/10 flex flex-col gap-3 transition-colors hover:border-white/30"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
                        {/* Before -> After Primitive Mapping */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded border border-white/20">
                            {item.name}
                          </span>
                          <span className="text-slate-400 font-bold">→</span>
                          <span className="text-emerald-300 font-bold bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-800/60 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            {item.recommendation?.replacement || 'NIST ML-KEM / ML-DSA'}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 truncate max-w-xs" title={item.location.path}>
                          {item.location.path}{item.location.line ? `:${item.location.line}` : ''}
                        </span>
                      </div>

                      {/* Trade-off notes */}
                      {item.recommendation && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-2 border-t border-white/5 font-sans leading-relaxed">
                          <p>
                            <strong className="font-mono text-slate-200">Latency impact:</strong>{' '}
                            {item.recommendation.latencyNote || 'Evaluated for standard enterprise throughput'}
                          </p>
                          <p>
                            <strong className="font-mono text-slate-200">Payload / Cost:</strong>{' '}
                            {item.recommendation.costNote || 'Standard post-quantum key expansion'}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 2: Classical Legacy Risk Items */}
              <div className="bg-black/60 border border-white/15 rounded-2xl p-6 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)] flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                    <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                      Classical Legacy Risk Items (Pre-Quantum Weakness)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {legacyRiskItems.length} deprecated primitives
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Algorithms with known collision attacks, block cipher vulnerabilities, or weak key sizes regardless of quantum computing. Replace with standard AES-256 or SHA-384.
                </p>

                <div className="space-y-3 font-mono text-xs">
                  {legacyRiskItems.map((item) => (
                    <div
                      key={item.artefactId}
                      className="p-3.5 rounded-xl bg-black/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-amber-300 font-semibold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                          {item.name}
                        </span>
                        <span className="text-slate-400 text-xs font-sans">
                          {item.riskLevel === 'critical' || item.riskLevel === 'high' ? 'High risk: Deprecated primitive' : 'Medium risk: Check key parameters'}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-500 truncate max-w-xs">
                        {item.location.path}{item.location.line ? `:${item.location.line}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 3. EXPORT PANEL & JSON PREVIEW */}
            <section className="bg-black/60 border border-white/15 rounded-2xl p-6 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)] flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex flex-col gap-1">
                  <h2
                    className="text-xl font-bold text-white tracking-tight"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    Export as CycloneDX-CBOM
                  </h2>
                  <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                    Standardized CycloneDX 1.6 Cryptographic Bill of Materials schema format for enterprise risk reporting, defense mandates, and supply chain audit.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDownload('html')}
                    className="text-xs px-3 py-2 rounded-xl"
                  >
                    Print HTML
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyClipboard}
                    className="text-xs px-3.5 py-2 rounded-xl"
                  >
                    {copied ? '✓ Copied!' : 'Copy JSON'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleDownload('cbom')}
                    className="text-xs px-4 py-2 rounded-xl"
                  >
                    Download CBOM
                  </Button>
                </div>
              </div>

              {/* Live JSON Preview Window */}
              <div className="relative group">
                <div className="absolute right-4 top-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-black/80 px-2.5 py-1 rounded border border-white/10 z-10">
                  SCHEMA: CYCLONEDX 1.6 CBOM
                </div>

                <pre className="p-4 sm:p-5 rounded-xl bg-black/90 border border-white/15 text-slate-300 font-mono text-xs overflow-x-auto max-h-[420px] whitespace-pre leading-relaxed select-all">
                  <code>{rawCbomJson}</code>
                </pre>
              </div>
            </section>
          </>
        )}

        {/* 4. FOOTER NAV */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500 pt-6 border-t border-white/10">
          <div className="flex items-center gap-6">
            <a href={`/dashboard?scan_id=${scanId}`} className="hover:text-white transition-colors">
              ← Return to dashboard
            </a>
            <a href={`/artefacts?scan_id=${scanId}`} className="hover:text-white transition-colors">
              Explore all artefacts
            </a>
          </div>

          <span>CBOM REPORT ENGINE v1.4.2</span>
        </footer>

      </div>
    </Background>
  );
}

export default function ReportsPage() {
  return (
    <>
      <AppNav />
      <Suspense fallback={
        <Background>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-slate-400 font-mono text-xs animate-pulse">
            Loading cryptographic reports...
          </div>
        </Background>
      }>
        <ReportsContent />
      </Suspense>
    </>
  );
}