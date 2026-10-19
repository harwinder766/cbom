'use client';

import React from 'react';
import Link from 'next/link';
import ShorsSimulator from './components/ShorsSimulator';
import MoscaSimulator from './components/MoscaSimulator';
import CryptoClassification from './components/CryptoClassification';

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/20 selection:text-white flex flex-col relative overflow-x-hidden">
      {/* Background ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-1/4 right-1/4 w-[500px] h-[300px] bg-blue-500/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Header Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-black/70 border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="font-bold text-lg tracking-tight text-white hover:text-white/80 transition-colors flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_#ffffff]" />
            CBOM · Quantum Cryptography Academy
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-medium text-white/60 hover:text-white transition-colors"
            >
              ← Back to Overview
            </Link>
            <Link
              href="/scan"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all"
            >
              Scanner Tool
            </Link>
          </div>
        </div>
      </header>

      {/* Main Educational Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 relative z-10 w-full">
        {/* Hero Section */}
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-xs font-mono text-white/70 mb-4">
            <span>🔬 Interactive CS Education</span>
            <span>·</span>
            <span>Zero Backend Dependency</span>
          </div>

          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 leading-[1.15]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            How Quantum Computers Break Cryptography
          </h1>

          <p className="text-base sm:text-lg text-white/60 leading-relaxed mb-6">
            Modern internet security relies on mathematical problems that are easy to compute in one direction, but take billions of years to invert on classical silicon. Explore the quantum algorithms and risk formulas that rewrite these rules.
          </p>

          {/* Quick Jump Bar */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-white/40">JUMP TO:</span>
            <a
              href="#shors-algorithm"
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              1. Shor&apos;s Simulator
            </a>
            <a
              href="#moscas-inequality"
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              2. Mosca&apos;s Inequality &amp; Risk Engine
            </a>
            <a
              href="#crypto-matrix"
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              3. Algorithm Classification
            </a>
          </div>
        </div>

        {/* Section 1: Shor's Algorithm */}
        <section id="shors-algorithm" className="mb-20 scroll-mt-20">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                MODULE 1
              </span>
              <span className="text-xs font-mono text-white/40">Asymmetric Cryptanalysis</span>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold text-white mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Shor&apos;s Algorithm: Factoring in Polynomial Time
            </h2>
            <p className="text-sm text-white/60 max-w-3xl leading-relaxed">
              RSA and Elliptic Curve Cryptography (ECC) depend on the classical difficulty of factoring large numbers and discrete logarithms. Peter Shor proved that a quantum computer can find the period of modular exponentiation in polynomial time <code className="text-white/80 font-mono">O((log n)³)</code>, completely breaking RSA and ECC.
            </p>
          </div>

          <ShorsSimulator />
        </section>

        {/* Section 2: Mosca's Inequality & Risk Engine */}
        <section id="moscas-inequality" className="mb-20 scroll-mt-20">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                MODULE 2
              </span>
              <span className="text-xs font-mono text-white/40">Quantum Migration Timelines</span>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold text-white mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Mosca&apos;s Inequality &amp; Harvest-Now-Decrypt-Later
            </h2>
            <p className="text-sm text-white/60 max-w-3xl leading-relaxed">
              Dr. Michele Mosca established the mathematical inequality for quantum migration urgency: if the time data must remain confidential (X) plus the time required to migrate infrastructure (Y) exceeds the arrival of a Cryptanalytically Relevant Quantum Computer (Z), your organization is already exposed to retrospective interception today.
            </p>
          </div>

          <MoscaSimulator />
        </section>

        {/* Section 3: Crypto Classification Matrix */}
        <section id="crypto-matrix" className="mb-20 scroll-mt-20">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                MODULE 3
              </span>
              <span className="text-xs font-mono text-white/40">Knowledge Base Mirror</span>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold text-white mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Cryptographic Algorithm Matrix &amp; PQC Standards
            </h2>
            <p className="text-sm text-white/60 max-w-3xl leading-relaxed">
              Explore how ECDAT classifies cryptographic assets found across source code, binaries, and containers. Differentiate between algorithms completely broken by Shor&apos;s algorithm, ciphers weakened by Grover&apos;s algorithm, and standardized NIST Post-Quantum replacements (FIPS 203, 204, 205).
            </p>
          </div>

          <CryptoClassification />
        </section>

        {/* Bottom CTA: Link to Real Code Audit */}
        <section className="mt-20 pt-12 border-t border-white/10 text-center">
          <div className="max-w-xl mx-auto p-8 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/15 backdrop-blur-xl">
            <h3
              className="text-xl sm:text-2xl font-bold text-white mb-3"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Now see this on real code
            </h3>
            <p className="text-sm text-white/60 mb-6 leading-relaxed">
              Now that you understand how Shor&apos;s algorithm, Mosca&apos;s inequality, and ECDAT&apos;s risk scoring engine work, scan your repositories and binaries to detect vulnerable RSA, ECC, and weak symmetric ciphers in seconds.
            </p>
            <Link
              href="/scan"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all duration-200 active:scale-[0.98]"
            >
              <span>Launch Cryptographic Scanner</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/90 py-8 relative z-10 text-center text-xs text-white/40">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>CBOM Quantum Readiness · Interactive Education</div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/scan" className="hover:text-white transition-colors">Scan</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
