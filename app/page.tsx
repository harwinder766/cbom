'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MagneticButton } from '@/components/ui/magnetic-button';

// ============================================================================
// Aceternity UI: Background Ripple Effect Component (Canvas-driven)
// ============================================================================
function BackgroundRippleEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Ripple state
    interface Ripple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      alpha: number;
      speed: number;
    }

    let ripples: Ripple[] = [];

    const addRipple = (x: number, y: number) => {
      ripples.push({
        x,
        y,
        radius: 0,
        maxRadius: Math.max(width, height) * 0.45,
        alpha: 0.35,
        speed: 2.2,
      });
    };

    // Periodically spawn ambient ripples for background motion
    const interval = setInterval(() => {
      if (ripples.length < 5) {
        addRipple(Math.random() * width, Math.random() * height);
      }
    }, 2200);

    // Click/Tap ripples
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      addRipple(clientX, clientY);
    };

    window.addEventListener('pointerdown', handlePointerDown);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Shiny Grid background overlay with glowing intersections
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 48;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Ripples with a crisp white/silver glow
      ripples.forEach((r, idx) => {
        r.radius += r.speed;
        r.alpha -= 0.0012;

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, r.alpha)})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(idx, 1);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerdown', handlePointerDown);
      clearInterval(interval);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-90"
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Component: MoscaReadout
// Live animated readout of Mosca's Inequality (X + Y > Z)
// ============================================================================
function MoscaReadout() {
  const [shelfLife, setShelfLife] = useState(10); // X years
  const [migrationTime, setMigrationTime] = useState(5); // Y years
  const [timeToCRQC, setTimeToCRQC] = useState(12); // Z years
  const [microTicks, setMicroTicks] = useState(842);

  const totalRequirement = shelfLife + migrationTime;
  const isViolated = totalRequirement > timeToCRQC;
  const deficit = totalRequirement - timeToCRQC;

  // Continuous micro-counter
  useEffect(() => {
    const interval = setInterval(() => {
      setMicroTicks((prev) => (prev > 999 ? 100 : prev + 1));
    }, 180);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/60 backdrop-blur-2xl p-6 md:p-8 font-mono shadow-[0_0_50px_-12px_rgba(255,255,255,0.12)] transition-all duration-300 hover:border-white/30 hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.2)]">
      {/* Glossy top border sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      {/* Visual sweep scanning line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/20 via-white/5 to-transparent animate-scan"
        aria-hidden="true"
      />

      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-2 text-xs text-white/70 tracking-wide">
          <span className="inline-block h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#ffffff] animate-pulse" />
          <span className="font-semibold text-white">MOSCA'S INEQUALITY READOUT</span>
        </div>
        <span className="text-[11px] text-white/40 font-mono tracking-wider">LIVE RISK CALCULATOR</span>
      </div>

      {/* Main Formula Visualization */}
      <div className="my-4 flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          <span className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            X<span className="text-white/50 font-normal text-2xl sm:text-3xl">({shelfLife}y)</span>
          </span>
          <span className="text-white/80">+</span>
          <span className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            Y<span className="text-white/50 font-normal text-2xl sm:text-3xl">({migrationTime}y)</span>
          </span>
          <span className={isViolated ? 'text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.6)]' : 'text-white/50'}>
            {isViolated ? '>' : '≤'}
          </span>
          <span className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            Z<span className="text-white/50 font-normal text-2xl sm:text-3xl">({timeToCRQC}y)</span>
          </span>
        </div>

        {/* Dynamic Status Alert Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-sans flex items-start gap-3 backdrop-blur-xl transition-all duration-200 ${
            isViolated
              ? 'bg-red-500/10 border-red-500/30 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
          }`}
        >
          <div className="mt-0.5 font-mono text-[10px] uppercase px-2 py-0.5 rounded-md bg-black/80 border border-current font-bold shrink-0 tracking-wider shadow-sm">
            {isViolated ? 'INEQUALITY VIOLATED' : 'WITHIN WINDOW'}
          </div>
          <div className="leading-relaxed">
            {isViolated ? (
              <span>
                <strong>System is already vulnerable.</strong> Required timeframe ({totalRequirement}y) exceeds estimated time to Quantum Computer ({timeToCRQC}y) by{' '}
                <strong className="font-mono text-red-400 underline decoration-red-500/50">{deficit} years</strong>.
              </span>
            ) : (
              <span>
                <strong>Migration window viable.</strong> Required timeframe ({totalRequirement}y) fits within estimated CRQC arrival ({timeToCRQC}y).
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Variable Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-5 border-t border-white/10">
        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/60 flex justify-between font-mono">
            <span className="font-semibold text-white">X: Shelf-Life</span>
            <span className="text-white font-semibold">{shelfLife} yrs</span>
          </div>
          <input
            type="range"
            min="1"
            max="25"
            value={shelfLife}
            onChange={(e) => setShelfLife(Number(e.target.value))}
            className="h-1.5 w-full accent-white bg-white/10 rounded-lg cursor-pointer"
            aria-label="X: Shelf-life in years"
          />
          <p className="text-[11px] font-sans text-white/40 leading-tight">
            Years sensitive data must remain secure.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/60 flex justify-between font-mono">
            <span className="font-semibold text-white">Y: Migration</span>
            <span className="text-white font-semibold">{migrationTime} yrs</span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            value={migrationTime}
            onChange={(e) => setMigrationTime(Number(e.target.value))}
            className="h-1.5 w-full accent-white bg-white/10 rounded-lg cursor-pointer"
            aria-label="Y: Migration time in years"
          />
          <p className="text-[11px] font-sans text-white/40 leading-tight">
            Years to re-architect infrastructure to PQC.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/60 flex justify-between font-mono">
            <span className="font-semibold text-white">Z: CRQC Arrival</span>
            <span className="text-white font-semibold">{timeToCRQC} yrs</span>
          </div>
          <input
            type="range"
            min="5"
            max="30"
            value={timeToCRQC}
            onChange={(e) => setTimeToCRQC(Number(e.target.value))}
            className="h-1.5 w-full accent-white bg-white/10 rounded-lg cursor-pointer"
            aria-label="Z: Time to CRQC arrival in years"
          />
          <p className="text-[11px] font-sans text-white/40 leading-tight">
            Estimated years until Shor's Algorithm runs at scale.
          </p>
        </div>
      </div>

      {/* Footer Telemetry */}
      <div className="mt-6 pt-3 border-t border-white/10 flex justify-between items-center text-[10px] text-white/30 uppercase tracking-widest font-mono">
        <span>TICK_REF: {microTicks}.098ms</span>
        <span>RULE: MOSCA_EQ_SYS_V2.4</span>
      </div>
    </div>
  );
}

// ============================================================================
// Component: ShorVisualizer
// Visual diagram contrasting Shor's vs Grover's Algorithm
// ============================================================================
function ShorVisualizer() {
  const brokenAlgorithms = [
    { name: 'RSA-2048 / RSA-4096', type: 'Asymmetric Key Exchange / Signatures', impact: 'Broken (Complete Key Recovery)' },
    { name: 'ECDSA (P-256 / P-384)', type: 'Elliptic Curve Signatures', impact: 'Broken (Private Key Extraction)' },
    { name: 'ECDH / DH', type: 'Key Agreement', impact: 'Broken (Session Decryption)' },
  ];

  const weakenedAlgorithms = [
    { name: 'AES-128', type: 'Symmetric Cipher', impact: 'Weakened to ~64-bit security' },
    { name: 'AES-256', type: 'Symmetric Cipher', impact: 'Quantum Resistant (~128-bit)' },
    { name: 'SHA-256 / SHA-3', type: 'Cryptographic Hashing', impact: 'Weakened (Use SHA-384 / SHA-512)' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-6 font-sans">
      {/* Shor's Algorithm Threat */}
      <div className="p-6 bg-black/60 backdrop-blur-xl rounded-2xl border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)] relative overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
          <span className="font-mono text-xs text-red-400 font-semibold uppercase tracking-wider">
            Shor's Algorithm Impact
          </span>
          <span className="text-[11px] font-mono text-white/50">Polynomial Time</span>
        </div>
        <p className="text-xs text-white/60 mb-4 leading-relaxed">
          Completely solves prime factorization and discrete logarithms. All asymmetric primitives fall.
        </p>
        <ul className="space-y-3">
          {brokenAlgorithms.map((algo) => (
            <li key={algo.name} className="bg-black/80 p-3 rounded-xl border border-white/10 hover:border-red-500/40 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white font-semibold">{algo.name}</span>
                <span className="text-red-400 text-[10px] px-2 py-0.5 rounded-md bg-red-950/60 border border-red-800/50 font-mono font-semibold">
                  CRITICAL
                </span>
              </div>
              <p className="text-[11px] text-white/50 mt-1.5">{algo.type} — {algo.impact}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Grover's Algorithm Impact */}
      <div className="p-6 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/15 shadow-[0_0_30px_rgba(255,255,255,0.05)] relative overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
          <span className="font-mono text-xs text-white font-semibold uppercase tracking-wider">
            Grover's Search Impact
          </span>
          <span className="text-[11px] font-mono text-white/50">Quadratic Speedup</span>
        </div>
        <p className="text-xs text-white/60 mb-4 leading-relaxed">
          Halves effective bit-security for unstructured searches. Symmetric algorithms remain viable with larger key sizes.
        </p>
        <ul className="space-y-3">
          {weakenedAlgorithms.map((algo) => (
            <li key={algo.name} className="bg-black/80 p-3 rounded-xl border border-white/10 hover:border-white/30 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white font-semibold">{algo.name}</span>
                <span className="text-white/70 text-[10px] px-2 py-0.5 rounded-md bg-white/10 border border-white/20 font-mono font-semibold">
                  MITIGATED
                </span>
              </div>
              <p className="text-[11px] text-white/50 mt-1.5">{algo.type} — {algo.impact}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Export
// ============================================================================
export default function App() {
  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased flex flex-col relative selection:bg-white/20 selection:text-white">
      {/* Import Inter, Space Grotesk, IBM Plex Mono dynamically */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
      />

      {/* Dynamic Keyframes for Laser Scan & Glow effects */}
      <style>{`
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background-color: #000000;
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(1000%); opacity: 0; }
        }
        .animate-scan {
          animation: scanline 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-scan { animation: none; }
        }
      `}</style>

      {/* Aceternity UI Canvas Background Ripple Effect */}
      <BackgroundRippleEffect />

      {/* Ambient background glows for high-end glossy atmosphere */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-white/[0.03] rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-1/3 left-1/4 w-[400px] h-[250px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Content Wrapper overlaying canvas */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* 1. NAV (sticky, minimal, glossy) */}
        <header className="sticky top-0 z-50 backdrop-blur-2xl bg-black/60 border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <a
              href="/"
              className="font-bold text-lg tracking-tight text-white hover:text-white/80 transition-colors flex items-center gap-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_#ffffff]" />
              CBOM · PQ Readiness
            </a>

            <nav className="flex items-center gap-6">
              <a
                href="#how-it-works"
                className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block font-medium"
              >
                How it works
              </a>
              <a
                href="/learn"
                className="text-sm text-white/90 hover:text-white transition-colors font-medium flex items-center gap-1.5"
              >
                <span>Learn</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded bg-white/20 text-white border border-white/30">
                  NEW
                </span>
              </a>

              {/* Inner pages nav */}
              <div className="hidden md:flex items-center gap-1 border-l border-white/10 pl-6">
                {[
                  { label: 'Dashboard', href: '/dashboard' },
                  { label: 'Scan',      href: '/scan'      },
                  { label: 'Artefacts', href: '/artefacts' },
                  { label: 'Risk Graph',href: '/risk-graph'},
                  { label: 'Reports',   href: '/reports'   },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="text-sm text-white/50 hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-white/5"
                  >
                    {item.label}
                  </a>
                ))}
              </div>

              {/* Shiny Primary White Button */}
              <MagneticButton>
                <a
                  href="/scan"
                  className="text-sm font-semibold px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.6)] transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black inline-block"
                >
                  Start a Scan
                </a>
              </MagneticButton>
            </nav>
          </div>
        </header>

        <main className="flex-1">
          {/* 2. HERO SECTION */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 md:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left Content Column */}
              <div className="lg:col-span-7 flex flex-col items-start text-left">
                <p className="text-xs font-mono tracking-widest text-white/60 uppercase mb-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                  Quantum computers don't exist yet. The risk already does.
                </p>

                <h1
                  className="font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-[1.1] mb-6 max-w-2xl tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Find every line of vulnerable cryptography before it's too late to migrate.
                </h1>

                <p className="text-base sm:text-lg text-white/60 mb-8 max-w-[62ch] leading-relaxed">
                  Scan source code, compiled binaries, third-party dependencies, and container images to build a standardized Cryptographic Bill of Materials (CBOM) and score your organization's quantum exposure.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                  <MagneticButton>
                    <a
                      href="/learn"
                      className="w-full sm:w-auto text-center px-6 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.35)] hover:shadow-[0_0_40px_rgba(255,255,255,0.55)] transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black inline-block"
                    >
                      Start Learning
                    </a>
                  </MagneticButton>
                  <MagneticButton>
                    <a
                      href="/scan"
                      className="w-full sm:w-auto text-center px-6 py-3.5 rounded-xl border border-white/20 bg-black/60 hover:bg-white/10 text-white font-medium text-sm backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-black inline-block"
                    >
                      Start a Scan
                    </a>
                  </MagneticButton>
                </div>

                {/* Supported Parsers */}
                <div className="mt-12 pt-6 border-t border-white/10 text-xs font-mono text-white/50 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-semibold text-white/70">PARSERS:</span>
                  <span className="text-white bg-white/5 px-2.5 py-1 rounded-md border border-white/10 backdrop-blur-md">Python</span>
                  <span className="text-white bg-white/5 px-2.5 py-1 rounded-md border border-white/10 backdrop-blur-md">C / C++</span>
                  <span className="text-white bg-white/5 px-2.5 py-1 rounded-md border border-white/10 backdrop-blur-md">Java</span>
                </div>
              </div>

              {/* Right Column: Animated Mosca Readout Centerpiece */}
              <div className="lg:col-span-5 w-full">
                <MoscaReadout />
              </div>
            </div>
          </section>

          {/* 3. THE PROBLEM SECTION */}
          <section className="border-t border-white/10 bg-black/80 backdrop-blur-2xl py-20 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
              <div className="max-w-3xl text-left mb-8">
                <h2
                  className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight drop-shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  The "Harvest Now, Decrypt Later" Threat
                </h2>
                <p className="text-white/60 text-base leading-relaxed max-w-[68ch]">
                  State actors and sophisticated adversaries are actively intercepting and storing encrypted network traffic today. When a Cryptographically Relevant Quantum Computer (CRQC) becomes operational, historical records encrypted with RSA, ECC, or Diffie-Hellman will be decrypted retroactively in minutes.
                </p>
              </div>

              {/* Threat Diagram */}
              <ShorVisualizer />
            </div>
          </section>

          {/* 4. WHAT IT DOES SECTION */}
          <section id="how-it-works" className="py-24 max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-left mb-12">
              <h2
                className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Automated Quantum Risk Intelligence
              </h2>
              <p className="text-white/60 text-base max-w-[65ch]">
                Complete visibility into your cryptographic posture, from legacy primitives to post-quantum readiness.
              </p>
            </div>

            {/* Asymmetric Grid Layout with Shiny Card Borders */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Step 1: Discover (Span 7) */}
              <div className="lg:col-span-7 bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.08)] relative overflow-hidden group">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-white font-semibold tracking-wider">01 / DISCOVER</span>
                    <span className="font-mono text-[11px] text-white/40">STATIC & BINARY ANALYSIS</span>
                  </div>
                  <h3
                    className="text-xl font-bold text-white mb-2"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    Inventory every cryptographic asset
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-[60ch]">
                    Scan source repositories, compiled executables, vendor dependencies, and TLS configuration files. Identify hardcoded keys, legacy algorithms, key lengths, and cipher suite parameters automatically.
                  </p>
                </div>

                <div className="bg-black/90 p-4 rounded-xl border border-white/10 font-mono text-xs text-white/60 space-y-1 shadow-inner">
                  <div className="text-emerald-400 font-semibold">$ cbom-cli scan ./src --output=cbom.json</div>
                  <div className="text-white/50">[+] Detected: OpenSSL 1.1.1k (Vulnerable to RSA-2048 deprecation)</div>
                  <div className="text-white/50">[+] Discovered 42 instances of ECDSA P-256 in auth_service.go</div>
                </div>
              </div>

              {/* Step 2: Assess (Span 5) */}
              <div className="lg:col-span-5 bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.08)] relative overflow-hidden group">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-white font-semibold tracking-wider">02 / ASSESS</span>
                    <span className="font-mono text-[11px] text-white/40">MOSCA EVALUATION</span>
                  </div>
                  <h3
                    className="text-xl font-bold text-white mb-2"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    Quantify migration urgency
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-4">
                    Applies Mosca's inequality tailored to your specific data retention policies. Categorizes exposure into Critical, High, Medium, and Low risk buckets.
                  </p>
                </div>

                <div className="bg-black/90 p-4 rounded-xl border border-white/10 font-mono text-xs space-y-2 shadow-inner">
                  <div className="flex justify-between items-center text-red-400 font-semibold">
                    <span>CRITICAL RISK</span>
                    <span>X+Y &gt; Z by 3.2 yrs</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full w-[85%] shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                  </div>
                </div>
              </div>

              {/* Step 3: Recommend (Span 5) */}
              <div className="lg:col-span-5 bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.08)] relative overflow-hidden group">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-white font-semibold tracking-wider">03 / RECOMMEND</span>
                    <span className="font-mono text-[11px] text-white/40">NIST PQC STANDARDS</span>
                  </div>
                  <h3
                    className="text-xl font-bold text-white mb-2"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    Map to NIST Post-Quantum Primitives
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-4">
                    Get exact replacement paths for vulnerable code paths with latency, ciphertext size overhead, and memory footprint projections.
                  </p>
                </div>

                <div className="bg-black/90 p-4 rounded-xl border border-white/10 font-mono text-xs space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-white/60">
                    <span>RSA-2048 / ECDH</span>
                    <span className="text-white font-bold">→</span>
                    <span className="text-white font-semibold drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]">ML-KEM-768</span>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>ECDSA P-256</span>
                    <span className="text-white font-bold">→</span>
                    <span className="text-white font-semibold drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]">ML-DSA-65</span>
                  </div>
                </div>
              </div>

              {/* Step 4: Report (Span 7) */}
              <div className="lg:col-span-7 bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.08)] relative overflow-hidden group">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-white font-semibold tracking-wider">04 / REPORT</span>
                    <span className="font-mono text-[11px] text-white/40">CYCLONEDX CBOM SPEC</span>
                  </div>
                  <h3
                    className="text-xl font-bold text-white mb-2"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    Export compliance-ready CBOM reports
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-[60ch]">
                    Generate standardized CycloneDX 1.6 Cryptographic Bill of Materials (CBOM) JSON and PDF reports for executive auditors, defense mandate compliance, and supply chain transparency.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                  <span className="px-3 py-1 rounded-lg bg-black/90 border border-white/15 text-white shadow-sm">
                    specVersion: "1.6"
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-black/90 border border-white/15 text-white shadow-sm">
                    type: "cryptographic-asset"
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-black/90 border border-white/15 text-white/50 shadow-sm">
                    Format: JSON / CycloneDX
                  </span>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* 5. FOOTER */}
        <footer className="border-t border-white/10 bg-black/90 backdrop-blur-2xl py-12 relative">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex flex-col gap-1 text-left">
              <span
                className="font-bold text-sm tracking-tight text-white flex items-center gap-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
                CBOM · PQ Readiness
              </span>
              <p className="text-xs text-white/50">
                Inventory cryptography. Assess quantum risk. Migrate systematically.
              </p>
            </div>

            <div className="flex items-center gap-6 text-xs text-white/50 font-medium">
              <a href="/learn" className="hover:text-white transition-colors flex items-center gap-1.5">
                <span>Learn</span>
                <span className="px-1 py-0.2 text-[9px] font-bold uppercase rounded bg-white/20 text-white">
                  NEW
                </span>
              </a>
              <a href="/scan" className="hover:text-white transition-colors">
                CLI Tool
              </a>
              <a href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}