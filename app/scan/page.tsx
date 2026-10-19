'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BackgroundRippleEffect } from "@/components/ui/background-ripple-effect";
import { MagneticButton } from "@/components/ui/magnetic-button";
import AppNav from '@/app/components/navbar';
import { api, setActiveScanId } from '@/lib/api';

interface UploadedFile {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  sizeFormatted: string;
  file: File;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.venv',
  'venv',
  'env',
  '__pycache__',
  'dist',
  'build',
  'out',
  '.turbo',
  '.cache',
  'vendor',
]);

const MAX_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB

function shouldIgnorePath(relPath: string): boolean {
  const parts = relPath.replace(/\\/g, '/').split('/');
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (IGNORED_DIRS.has(part) || part.startsWith('.')) {
      return true;
    }
  }
  return false;
}

async function readEntryRecursively(
  entry: any,
  pathPrefix = ''
): Promise<{ file: File; relativePath: string }[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file: File) => {
          const fullPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
          if (shouldIgnorePath(fullPath)) {
            resolve([]);
          } else {
            resolve([{ file, relativePath: fullPath }]);
          }
        },
        () => resolve([])
      );
    });
  } else if (entry.isDirectory) {
    const dirName = entry.name;
    if (IGNORED_DIRS.has(dirName) || dirName.startsWith('.')) {
      return [];
    }
    const reader = entry.createReader();
    const entries: any[] = await new Promise((resolve) => {
      const allEntries: any[] = [];
      const readBatch = () => {
        reader.readEntries(
          (batch: any[]) => {
            if (!batch || batch.length === 0) {
              resolve(allEntries);
            } else {
              allEntries.push(...batch);
              readBatch();
            }
          },
          () => resolve(allEntries)
        );
      };
      readBatch();
    });

    const nextPrefix = pathPrefix ? `${pathPrefix}/${dirName}` : dirName;
    const nested = await Promise.all(
      entries.map((child) => readEntryRecursively(child, nextPrefix))
    );
    return nested.flat();
  }
  return [];
}

export default function StartScanPage() {
  // Source Selection State
  const [activeTab, setActiveTab] = useState<'github' | 'local' | 'upload'>('github');
  const [allowLocalScans, setAllowLocalScans] = useState<boolean>(true);
  const [githubUrl, setGithubUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Scan Targets State
  const [scanTargets, setScanTargets] = useState({
    sourceCode: true,
    binaries: true,
    dependencies: true,
    containers: true,
  });

  // Metadata Tagging State
  const [exposureTag, setExposureTag] = useState<'internal' | 'external'>('internal');

  // Live Progress & API State
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Initializing workspace sandbox...');
  const [artefactsFound, setArtefactsFound] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [activeScanId, setLocalActiveScanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.getConfig()
      .then((cfg) => {
        if (isMounted && typeof cfg.allowLocalScans === 'boolean') {
          setAllowLocalScans(cfg.allowLocalScans);
          if (!cfg.allowLocalScans) {
            setActiveTab((prev) => (prev === 'local' ? 'github' : prev));
          }
        }
      })
      .catch(() => {
        // Fallback default
      });

    return () => {
      isMounted = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const totalUploadSizeBytes = uploadedFiles.reduce((acc, u) => acc + (u.size || u.file?.size || 0), 0);
  const isOverUploadLimit = totalUploadSizeBytes > MAX_UPLOAD_LIMIT_BYTES;

  // Validate current active tab input
  const isSourceValid = useCallback(() => {
    if (activeTab === 'github') {
      return githubUrl.trim().toLowerCase().startsWith('https://github.com/');
    }
    if (activeTab === 'local') {
      return allowLocalScans && localPath.trim().length > 0;
    }
    if (activeTab === 'upload') {
      return uploadedFiles.length > 0;
    }
    return false;
  }, [activeTab, githubUrl, localPath, uploadedFiles]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFiles = (items: { file: File; relativePath: string }[]) => {
    const validItems = items.filter((item) => !shouldIgnorePath(item.relativePath));
    const newFiles: UploadedFile[] = validItems.map((item, idx) => ({
      id: `${item.relativePath}-${item.file.size}-${Date.now()}-${idx}`,
      name: item.relativePath || item.file.name,
      relativePath: item.relativePath || item.file.name,
      size: item.file.size,
      sizeFormatted: formatFileSize(item.file.size),
      file: item.file,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === 'function') {
      const entryPromises: Promise<{ file: File; relativePath: string }[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = (item as any).webkitGetAsEntry?.();
        if (entry) {
          entryPromises.push(readEntryRecursively(entry));
        }
      }
      const results = (await Promise.all(entryPromises)).flat();
      if (results.length > 0) {
        processFiles(results);
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files).map((f) => ({
        file: f,
        relativePath: (f as any).webkitRelativePath || f.name,
      }));
      processFiles(fileList);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files).map((f) => ({
        file: f,
        relativePath: (f as any).webkitRelativePath || f.name,
      }));
      processFiles(fileList);
      e.target.value = '';
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files).map((f) => ({
        file: f,
        relativePath: (f as any).webkitRelativePath || f.name,
      }));
      processFiles(fileList);
      e.target.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Toggle Target Checkboxes
  const toggleTarget = (key: keyof typeof scanTargets) => {
    setScanTargets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Start Real Scan Pipeline via API
  const handleStartScan = async () => {
    if (!isSourceValid() || isScanning) return;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setErrorMessage(null);
    setIsScanning(true);
    setProgress(5);
    setArtefactsFound(0);
    setIsComplete(false);
    setCurrentStage('Submitting scan job to ECDAT engine...');

    try {
      let scanResult;
      if (activeTab === 'github') {
        scanResult = await api.startScan({
          type: 'github',
          target: githubUrl.trim(),
          exposure: exposureTag,
          options: scanTargets,
        });
      } else if (activeTab === 'local') {
        if (!allowLocalScans) {
          throw new Error('Local path scans are disabled on this server instance for security.');
        }
        scanResult = await api.startScan({
          type: 'local',
          target: localPath.trim(),
          exposure: exposureTag,
          options: scanTargets,
        });
      } else {
        const filesToUpload = uploadedFiles
          .filter((u) => u.file)
          .map((u) => ({
            file: u.file,
            relativePath: u.relativePath,
          }));
        if (filesToUpload.length === 0) throw new Error('No file selected for upload.');
        scanResult = await api.uploadScan(filesToUpload, exposureTag);
      }

      const scanId = scanResult.id;
      setLocalActiveScanId(scanId);
      setActiveScanId(scanId);
      setCurrentStage('Scan worker started. Monitoring pipeline...');

      // Poll status until completion
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await api.getScanStatus(scanId);
          setProgress(status.progress || 10);
          if (status.currentStage) {
            setCurrentStage(status.currentStage);
          }
          setArtefactsFound(status.artefactsFound || 0);

          if (status.status === 'completed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setProgress(100);
            setCurrentStage('Done.');
            setIsScanning(false);
            setIsComplete(true);
          } else if (status.status === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsScanning(false);
            setErrorMessage(status.error || 'Scan pipeline failed.');
            setCurrentStage('Failed.');
          }
        } catch (pollErr: any) {
          // If polling fails temporarily, retain stage
        }
      }, 700);
    } catch (err: any) {
      setIsScanning(false);
      setErrorMessage(err.message || 'Failed to start scan.');
      setCurrentStage('Error initializing scan.');
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white font-sans antialiased selection:bg-white/20 selection:text-white">
      {/* Dynamic keyframes — mirrors main page */}
      <style>{`
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #000000; }
        @keyframes scanline {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(1000%); opacity: 0; }
        }
        .animate-scan { animation: scanline 4s cubic-bezier(0.4,0,0.6,1) infinite; }
        @media (prefers-reduced-motion: reduce) { .animate-scan { animation: none; } }
      `}</style>

      {/* Canvas ripple background */}
      <BackgroundRippleEffect />

      {/* Ambient glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-white/[0.03] rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-1/3 left-1/4 w-[400px] h-[250px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Navbar */}
      <AppNav />

      {/* Content layer */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 flex flex-col gap-8">

        {/* HEADER */}
        <header className="flex flex-col items-start gap-3">
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Start a new scan
          </h1>

          <p className="text-white/60 text-sm sm:text-base max-w-2xl leading-relaxed">
            Configure your target repository, binary, or dependency manifests to inventory cryptographic usage and evaluate post-quantum migration urgency.
          </p>
        </header>

        {/* MAIN SCAN FORM PANEL */}
        <div className="bg-black/60 border border-white/15 rounded-2xl p-6 sm:p-8 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(255,255,255,0.12)] flex flex-col gap-8 relative overflow-hidden">
          {/* Glossy top sheen */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* ERROR BANNER */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-red-200 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-red-400 font-bold">✕ ERROR:</span>
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* SECTION 1: SOURCE INPUT */}
          <section className="flex flex-col gap-4">
            <label className="text-xs font-mono uppercase tracking-wider text-white/70 font-semibold">
              01 / Select Scan Target Source
            </label>

            {/* Segmented Tab Control */}
            <div
              className={`grid ${allowLocalScans ? 'grid-cols-3' : 'grid-cols-2'} gap-1 bg-black/80 p-1 rounded-xl border border-white/10`}
              role="tablist"
              aria-label="Scan source options"
            >
              {(['github', 'local', 'upload'] as const)
                .filter((tab) => tab !== 'local' || allowLocalScans)
                .map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setErrorMessage(null);
                    }}
                    className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-white/40 ${
                      activeTab === tab
                        ? 'bg-white/10 text-white shadow-sm border border-white/20'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                  >
                    {tab === 'github' ? 'GitHub URL' : tab === 'local' ? 'Local Path' : 'Upload Files'}
                  </button>
                ))}
            </div>

            {/* Tab 1: GitHub URL */}
            {activeTab === 'github' && (
              <div className="flex flex-col gap-2 mt-1">
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  disabled={isScanning}
                  className="w-full bg-black/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent transition-all disabled:opacity-50"
                  aria-label="GitHub Repository URL"
                />
                <div className="flex items-center justify-between text-xs">
                  <p className="text-white/40">
                    We'll clone this into a temporary sandbox directory, scan for cryptographic primitives, and clean up afterward.
                  </p>
                  <button
                    type="button"
                    onClick={() => setGithubUrl('https://github.com/octocat/Hello-World')}
                    className="text-emerald-400 hover:text-emerald-300 underline font-mono shrink-0 ml-2"
                  >
                    Use sample repo
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Local Path */}
            {allowLocalScans && activeTab === 'local' && (
              <div className="flex flex-col gap-2 mt-1">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="backend/tests/fixtures/sample_repo"
                  disabled={isScanning}
                  className="w-full bg-black/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent transition-all disabled:opacity-50"
                  aria-label="Local filesystem path"
                />
                <div className="flex items-center justify-between text-xs">
                  <p className="text-white/40">
                    Provide a path on your local system (e.g. <code className="text-white/70">backend/tests/fixtures/sample_repo</code>).
                  </p>
                  <button
                    type="button"
                    onClick={() => setLocalPath('backend/tests/fixtures/sample_repo')}
                    className="text-emerald-400 hover:text-emerald-300 underline font-mono shrink-0 ml-2"
                  >
                    Use sample repo
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Upload Files */}
            {activeTab === 'upload' && (
              <div className="flex flex-col gap-3 mt-1">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center gap-3 transition-colors ${
                    isDragging
                      ? 'border-white/50 bg-white/5'
                      : 'border-white/15 bg-black/60 hover:border-white/30'
                  }`}
                >
                  <p className="text-sm text-white/80 font-medium">
                    Drag and drop a project folder, .zip archive, source files, or SBOM manifests here
                  </p>
                  <p className="text-xs text-white/40">
                    Supports .zip, .tar, .tgz, or a whole folder (.py, .cpp, .go, .java, .bin, .json, .bom, .lock)
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".zip,.tar,.tgz,.py,.js,.ts,.jsx,.tsx,.java,.go,.c,.cpp,.cc,.h,.hpp,.cs,.json,.xml,.yaml,.yml,.lock,.bom,.bin,.so,.dll,.dylib"
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={isScanning}
                  />

                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    {...({ webkitdirectory: '', directory: '' } as any)}
                    onChange={handleFolderInputChange}
                    className="hidden"
                    disabled={isScanning}
                  />

                  <div className="flex items-center gap-2 mt-1">
                    <MagneticButton>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isScanning}
                        className="text-xs px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/40"
                      >
                        Browse files
                      </button>
                    </MagneticButton>

                    <MagneticButton>
                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        disabled={isScanning}
                        className="text-xs px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/40"
                      >
                        Browse folder
                      </button>
                    </MagneticButton>
                  </div>
                </div>

                {/* Uploaded File List */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex items-center justify-between text-xs font-mono text-white/70 px-1">
                      <span>
                        Selected: <strong className="text-white">{uploadedFiles.length}</strong> file{uploadedFiles.length === 1 ? '' : 's'} ({formatFileSize(totalUploadSizeBytes)})
                      </span>
                      {!isScanning && (
                        <button
                          type="button"
                          onClick={() => setUploadedFiles([])}
                          className="text-red-400 hover:text-red-300 underline font-mono text-xs transition-colors"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>

                    {isOverUploadLimit && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                          Total size ({formatFileSize(totalUploadSizeBytes)}) exceeds the 100 MB upload limit. Consider uploading a smaller archive or using Local Path scan.
                        </span>
                      </div>
                    )}

                    <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {uploadedFiles.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between bg-black/80 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-mono"
                        >
                          <span className="text-white truncate max-w-xs sm:max-w-md" title={file.relativePath}>
                            {file.relativePath}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-white/40">{file.sizeFormatted}</span>
                            {!isScanning && (
                              <button
                                type="button"
                                onClick={() => removeFile(file.id)}
                                className="text-white/30 hover:text-red-400 transition-colors p-1 focus:outline-none focus:ring-1 focus:ring-white/30 rounded"
                                aria-label={`Remove ${file.name}`}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <hr className="border-white/10" />

          {/* SECTION 2: SCAN TARGETS */}
          <section className="flex flex-col gap-4">
            <label className="text-xs font-mono uppercase tracking-wider text-white/70 font-semibold">
              02 / Configure Inspection Layers
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                {
                  key: 'sourceCode' as const,
                  title: 'Source code (Python/C++)',
                  desc: 'Scans ASTs, function calls, and imported crypto libraries.',
                },
                {
                  key: 'binaries' as const,
                  title: 'Compiled binaries',
                  desc: 'Analyzes ELF/PE headers, symbol tables, and static links.',
                },
                {
                  key: 'dependencies' as const,
                  title: 'Dependencies / SBOM',
                  desc: 'Parses package manifests (npm, PyPI, Cargo, Go) for legacy crypto.',
                },
                {
                  key: 'containers' as const,
                  title: 'Container images',
                  desc: 'Inspects filesystem layers for embedded certs and OpenSSL binaries.',
                },
              ]).map(({ key, title, desc }) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    scanTargets[key]
                      ? 'bg-white/5 border-white/20'
                      : 'bg-black/40 border-white/8 opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={scanTargets[key]}
                    onChange={() => toggleTarget(key)}
                    disabled={isScanning}
                    className="mt-1 h-4 w-4 rounded border-white/30 bg-black accent-white focus:ring-white/40 focus:ring-offset-black"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white">{title}</span>
                    <span className="text-xs text-white/40 leading-snug">{desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <hr className="border-white/10" />

          {/* SECTION 3: METADATA & RISK TAGGING */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-mono uppercase tracking-wider text-white/70 font-semibold">
              03 / System Exposure Tagging
            </label>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-black/60 p-4 rounded-xl border border-white/10">
              <div className="flex flex-col gap-0.5 max-w-md">
                <span className="text-sm font-medium text-white">
                  Tag this target system as:
                </span>
                <span className="text-xs text-white/40">
                  Influences Mosca's inequality weighting based on internet exposure and attack surface.
                </span>
              </div>

              <select
                value={exposureTag}
                onChange={(e) => setExposureTag(e.target.value as 'internal' | 'external')}
                disabled={isScanning}
                className="bg-black/80 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50 cursor-pointer"
                aria-label="Exposure Tagging"
              >
                <option value="internal">Internal (Backend, APIs, private tooling)</option>
                <option value="external">External-facing (Public web apps, edge proxies)</option>
              </select>
            </div>
          </section>

          {/* SECTION 4: TRIGGER & PROGRESS */}
          <div className="pt-2 flex flex-col gap-6">
            {!isComplete ? (
              <MagneticButton>
                <button
                  type="button"
                  onClick={handleStartScan}
                  disabled={!isSourceValid() || isScanning}
                  className="w-full py-3.5 text-sm font-semibold rounded-xl bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.35)] hover:shadow-[0_0_40px_rgba(255,255,255,0.55)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
                >
                  {isScanning ? 'Scanning Target...' : 'Start Scan'}
                </button>
              </MagneticButton>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0 border border-emerald-500/30">
                    ✓
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-emerald-200">
                      Scan complete — {artefactsFound} artefacts found
                    </span>
                    <span className="text-xs text-emerald-400/80 font-mono">
                      CycloneDX CBOM generated successfully.
                    </span>
                  </div>
                </div>

                <Link href={activeScanId ? `/dashboard?scan_id=${activeScanId}` : '/dashboard'} className="w-full sm:w-auto">
                  <MagneticButton>
                    <button
                      type="button"
                      className="w-full sm:w-auto text-xs px-5 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 font-semibold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
                    >
                      View dashboard
                    </button>
                  </MagneticButton>
                </Link>
              </div>
            )}

            {/* LIVE PROGRESS PANEL */}
            {(isScanning || isComplete) && (
              <div className="p-5 bg-black/80 border border-white/10 rounded-2xl flex flex-col gap-4 font-mono text-xs relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                {/* Progress Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${
                        isComplete ? 'bg-emerald-400 text-emerald-400' : 'bg-white animate-pulse'
                      }`}
                    />
                    <span className="text-white font-semibold uppercase tracking-wider">
                      {isComplete ? 'SCAN COMPLETED' : 'SCAN PIPELINE ACTIVE'}
                    </span>
                  </div>
                  <span className="text-white/60 font-bold">{progress}%</span>
                </div>

                {/* Progress Bar */}
                <div
                  className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-white h-full transition-all duration-150 ease-out shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Telemetry Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-white/40 pt-1">
                  <span className="text-white/70 truncate max-w-md">
                    Stage: {currentStage}
                  </span>
                  <span className="text-white font-semibold shrink-0">
                    Artefacts found so far: {artefactsFound}
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* FOOTER METADATA */}
        <footer className="flex items-center justify-between text-xs font-mono text-white/30 px-1">
          <span>PIPELINE ENGINE v1.4.2</span>
          <span>FORMAT: CYCLONEDX 1.6</span>
        </footer>

      </div>
    </div>
  );
}
