'use client';

import React, { useState, useMemo } from 'react';
import { KNOWN_ALGORITHMS, AlgorithmMetadata } from '@/lib/learn/knowledge_base';

export default function CryptoClassification() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmMetadata>(KNOWN_ALGORITHMS[0]);
  const [quizSelection, setQuizSelection] = useState<string | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  // Filtered list
  const filteredAlgos = useMemo(() => {
    return KNOWN_ALGORITHMS.filter((algo) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'shor' && algo.quantumStatus === 'shor_vulnerable') ||
        (selectedCategory === 'grover' && algo.quantumStatus === 'grover_weakened') ||
        (selectedCategory === 'broken' && algo.quantumStatus === 'classically_broken') ||
        (selectedCategory === 'safe' && algo.quantumStatus === 'quantum_safe');

      const matchesSearch =
        searchTerm === '' ||
        algo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        algo.aliases.some((al) => al.toLowerCase().includes(searchTerm.toLowerCase())) ||
        algo.description.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchTerm]);

  return (
    <div className="w-full bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-white font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]" />
          <h2
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Cryptographic Algorithm Classification Matrix
          </h2>
        </div>
        <div className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/70">
          Mirrors backend/app/services/knowledge_base.py
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10">
          {[
            { id: 'all', label: 'All Ciphers' },
            { id: 'shor', label: 'Shor Target (Broken by CRQC)' },
            { id: 'grover', label: 'Grover Weakened' },
            { id: 'broken', label: 'Classically Broken' },
            { id: 'safe', label: 'Post-Quantum Safe' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search algorithm or alias..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/40 font-mono w-full sm:w-56"
        />
      </div>

      {/* Main Matrix Workspace: List on left, details on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Algorithm List Table */}
        <div className="lg:col-span-5 space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {filteredAlgos.map((algo) => {
            const isSelected = selectedAlgo.name === algo.name;
            let badgeBg = 'bg-white/10 text-white';
            let statusText = 'SAFE';

            if (algo.quantumStatus === 'classically_broken') {
              badgeBg = 'bg-red-500/20 text-red-300 border border-red-500/30';
              statusText = 'BROKEN TODAY';
            } else if (algo.quantumStatus === 'shor_vulnerable') {
              badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
              statusText = 'SHOR TARGET';
            } else if (algo.quantumStatus === 'grover_weakened') {
              badgeBg = 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
              statusText = 'WEAKENED';
            } else {
              badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
              statusText = 'PQ SAFE';
            }

            return (
              <button
                key={algo.name}
                onClick={() => setSelectedAlgo(algo)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-white/15 border-white shadow-[0_0_15px_rgba(255,255,255,0.15)] text-white'
                    : 'bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div>
                  <div className="font-bold text-sm font-mono text-white flex items-center gap-2">
                    <span>{algo.name}</span>
                    <span className="text-[10px] font-normal text-white/40 uppercase">
                      ({algo.algorithmClass})
                    </span>
                  </div>
                  <div className="text-[11px] text-white/50 truncate max-w-[200px] mt-0.5">
                    {algo.aliases.slice(0, 3).join(', ')}
                  </div>
                </div>

                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${badgeBg}`}>
                  {statusText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Algorithm Deep-Dive Inspector */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-black/60 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-white/10">
              <div>
                <h3 className="text-xl font-bold font-mono text-white flex items-center gap-2">
                  {selectedAlgo.name}
                </h3>
                <div className="text-xs text-white/50 font-mono mt-0.5">
                  Type: {selectedAlgo.type} · Class: {selectedAlgo.algorithmClass}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-white/10 text-white border border-white/15">
                  Classical Bits: {selectedAlgo.classicalSecurityBits || '0 (Broken)'}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-white/80 leading-relaxed mb-4">
              {selectedAlgo.description}
            </p>

            {/* OID and Standards */}
            <div className="grid grid-cols-2 gap-3 mb-4 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] text-white/40">NIST STATUS</div>
                <div className="text-xs font-semibold text-white mt-0.5">{selectedAlgo.nistStatus}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] text-white/40">OID IDENTIFIER</div>
                <div className="text-xs font-semibold text-white mt-0.5 truncate">
                  {selectedAlgo.oid || 'N/A'}
                </div>
              </div>
            </div>

            {/* Aliases */}
            <div className="mb-4">
              <div className="text-[10px] font-mono uppercase text-white/40 mb-1.5">Known Aliases:</div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {selectedAlgo.aliases.map((al) => (
                  <span
                    key={al}
                    className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/70"
                  >
                    {al}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommended PQC Migration */}
            {selectedAlgo.recommendedReplacement && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 to-black/60 border border-emerald-500/30">
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-1">
                  Recommended NIST Post-Quantum Replacement:
                </div>
                <div className="text-sm font-bold text-white mb-1">
                  {selectedAlgo.recommendedReplacement}
                </div>
                <div className="text-xs text-emerald-200/80 leading-relaxed">
                  {selectedAlgo.replacementRationale}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 text-[11px] font-mono text-white/40 flex justify-between">
            <span>Direct ECDAT Scanner mapping</span>
            <span>Zero external API calls</span>
          </div>
        </div>
      </div>

      {/* Concept Check Quiz */}
      <div className="p-4 sm:p-5 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-bold mb-2">
          Concept Check: Why is AES-128 &quot;Weakened&quot; but RSA-2048 &quot;Broken&quot;?
        </div>
        <p className="text-sm font-medium text-white mb-3">
          Select the accurate statement distinguishing quantum impact on symmetric vs asymmetric cryptography:
        </p>

        {(() => {
          const choices = [
            {
              id: 'a',
              text: "Shor's algorithm achieves super-polynomial speedup (a polynomial-time algorithm versus the best known sub-exponential classical one) against RSA, whereas Grover's algorithm only provides a quadratic speedup against symmetric AES (reducing 128 bits to 64 bits).",
              correct: true,
              explanation:
                "Shor's polynomial-time factoring fundamentally breaks RSA/ECC, whereas Grover's quadratic speedup reduces 256 bits to 128 bits, leaving AES-256 computationally infeasible with any foreseeable hardware.",
            },
            {
              id: 'b',
              text: 'Symmetric keys are stored in hardware so quantum computers cannot evaluate them.',
              correct: false,
              explanation:
                'Key storage mechanisms do not change mathematical vulnerability to quantum search once ciphertext or handshake packets are captured.',
            },
            {
              id: 'c',
              text: 'AES is immune to all quantum algorithms.',
              correct: false,
              explanation:
                "Grover's algorithm still applies to AES, halving its effective security bits from 128 to 64 or 256 to 128.",
            },
          ];

          return (
            <>
              <div className="space-y-2 mb-3">
                {choices.map((ch) => {
                  let btnStyle = 'bg-black/30 border-white/10 text-white/70 hover:bg-white/5 hover:text-white';
                  if (quizSubmitted) {
                    if (ch.correct) {
                      btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold';
                    } else if (quizSelection === ch.id) {
                      btnStyle = 'bg-red-950/60 border-red-500 text-red-200';
                    } else {
                      btnStyle = 'bg-black/20 border-white/5 text-white/40 opacity-50';
                    }
                  }

                  return (
                    <button
                      key={ch.id}
                      disabled={quizSubmitted}
                      onClick={() => {
                        setQuizSelection(ch.id);
                        setQuizSubmitted(true);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-all border ${btnStyle}`}
                    >
                      {ch.text}
                    </button>
                  );
                })}
              </div>

              {quizSubmitted && quizSelection !== null && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 space-y-2">
                  <div>
                    {choices.find((c) => c.id === quizSelection)?.correct ? (
                      <span className="text-emerald-300 font-semibold">✓ Correct explanation: </span>
                    ) : (
                      <span className="text-red-400 font-semibold">✗ Why that choice is mistaken: </span>
                    )}
                    {choices.find((c) => c.id === quizSelection)?.explanation}
                  </div>

                  <button
                    onClick={() => {
                      setQuizSelection(null);
                      setQuizSubmitted(false);
                    }}
                    className="px-3 py-1 text-xs font-semibold rounded bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                  >
                    Try again
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
