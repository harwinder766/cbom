'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  getRegisterSize,
  findTruePeriod,
  computeQFTDistribution,
  continuedFractions,
  processMeasurement,
  factorizeWithPeriod,
  modPow,
  gcd,
  MeasurementResult,
  FactorizationResult,
} from '@/lib/learn/shor';

// Preset configurations for the learner
const SEMIPRIME_OPTIONS = [
  {
    n: 15,
    label: 'n = 15 (3 × 5)',
    bases: [
      { a: 2, note: 'Standard textbook case (r=4, gives factors 3 & 5)' },
      { a: 7, note: 'Coprime base (r=4, gives factors 3 & 5)' },
      { a: 14, note: 'Trivial factor failure: a^(r/2) ≡ -1 (mod 15)' },
      { a: 3, note: 'Shared factor shortcut: gcd(3, 15) = 3 > 1' },
    ],
  },
  {
    n: 21,
    label: 'n = 21 (3 × 7)',
    bases: [
      { a: 2, note: 'Standard case (r=6, gives factors 3 & 7)' },
      { a: 4, note: 'Odd period failure: r = 3 (odd, cannot halve)' },
      { a: 5, note: 'Coprime base (r=6, gives factors 3 & 7)' },
    ],
  },
  {
    n: 35,
    label: 'n = 35 (5 × 7)',
    bases: [
      { a: 6, note: 'Two sharp spikes: r = 2 divides Q = 2048 (peaks at 0 & 1024, factors 5 & 7)' },
      { a: 2, note: 'Spread peaks: r = 12 does not divide Q = 2048 (approx multiples)' },
      { a: 34, note: 'Trivial factor failure: r = 2, 34^1 ≡ -1 (mod 35), gcd(35, 35) = 35' },
    ],
  },
];

export default function ShorsSimulator() {
  const [selectedN, setSelectedN] = useState<number>(15);
  const [selectedA, setSelectedA] = useState<number>(2);
  const [currentStep, setCurrentStep] = useState<number>(1); // 1: Setup, 2: QFT, 3: Measurement, 4: Factors
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [activeQuizAnswer, setActiveQuizAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Play timer
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Current N options
  const currentNOption = useMemo(() => {
    return SEMIPRIME_OPTIONS.find((opt) => opt.n === selectedN) || SEMIPRIME_OPTIONS[0];
  }, [selectedN]);

  // Derived quantum math
  const { Q, q } = useMemo(() => getRegisterSize(selectedN), [selectedN]);
  const classicalGcd = useMemo(() => gcd(selectedA, selectedN), [selectedA, selectedN]);
  const hasSharedFactor = classicalGcd > 1;
  const truePeriod = useMemo(
    () => (hasSharedFactor ? 0 : findTruePeriod(selectedA, selectedN)),
    [selectedA, selectedN, hasSharedFactor]
  );

  // Modular sequence f(x) = a^x mod n for x in [0, min(16, Q)]
  const modSequence = useMemo(() => {
    const seq: { x: number; val: number }[] = [];
    const limit = Math.min(16, Q);
    for (let x = 0; x < limit; x++) {
      seq.push({ x, val: modPow(selectedA, x, selectedN) });
    }
    return seq;
  }, [selectedA, selectedN, Q]);

  // QFT probability distribution
  const qftDistribution = useMemo(() => {
    if (hasSharedFactor || truePeriod === 0) return [];
    return computeQFTDistribution(selectedN, selectedA, Q, truePeriod);
  }, [selectedN, selectedA, Q, truePeriod, hasSharedFactor]);

  // Total probability sum (always strictly 1.0)
  const totalProbabilitySum = useMemo(() => {
    if (qftDistribution.length === 0) return 0;
    return qftDistribution.reduce((acc, p) => acc + p, 0);
  }, [qftDistribution]);

  // Top peaks for visualization (multiples of Q/r and surrounding distribution)
  const peakData = useMemo(() => {
    if (qftDistribution.length === 0) return [];
    const rDividesQ = truePeriod > 0 && Q % truePeriod === 0;
    const step = truePeriod > 0 ? Q / truePeriod : 1;

    const peaks: { s: number; prob: number; isMultiple: boolean }[] = [];
    for (let s = 0; s < Q; s++) {
      const prob = qftDistribution[s];
      // Keep state if probability is non-negligible or an exact multiple
      if (prob > 0.005 || (rDividesQ && s % Math.round(step) === 0)) {
        const isMultiple = truePeriod > 0 && Math.abs(s - Math.round(s / step) * step) < 0.001;
        peaks.push({ s, prob, isMultiple });
      }
    }
    return peaks.sort((a, b) => a.s - b.s);
  }, [qftDistribution, Q, truePeriod]);

  // Factorization result
  const factorResult: FactorizationResult = useMemo(() => {
    if (hasSharedFactor) {
      return factorizeWithPeriod(selectedN, selectedA);
    }
    if (measurement && measurement.isValidPeriod) {
      return factorizeWithPeriod(selectedN, selectedA, measurement.candidateR);
    }
    if (truePeriod > 0) {
      return factorizeWithPeriod(selectedN, selectedA, truePeriod);
    }
    return factorizeWithPeriod(selectedN, selectedA);
  }, [selectedN, selectedA, hasSharedFactor, measurement, truePeriod]);

  // Reset when n or a changes
  useEffect(() => {
    setMeasurement(null);
    setCurrentStep(1);
    setIsPlaying(false);
  }, [selectedN, selectedA]);

  // Playback engine
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= 4) {
            setIsPlaying(false);
            return 4;
          }
          return prev + 1;
        });
      }, 2200);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying]);

  // Handle measurement trigger
  const handleMeasure = (targetS?: number) => {
    if (hasSharedFactor) {
      setMeasurement({
        s: 0,
        fractionStr: 'N/A',
        convergent: { p: 0, q: 1 },
        candidateR: 1,
        isValidPeriod: false,
        isDivisorOfPeriod: false,
        message: `gcd(${selectedA}, ${selectedN}) = ${classicalGcd} > 1. Classical factor found without quantum circuit!`,
      });
      setCurrentStep(3);
      return;
    }

    if (qftDistribution.length === 0) return;

    let sSample = targetS;
    if (sSample === undefined) {
      // Sample randomly according to QFT probability distribution
      const rand = Math.random();
      let cumulative = 0;
      for (let s = 0; s < Q; s++) {
        cumulative += qftDistribution[s];
        if (rand <= cumulative) {
          sSample = s;
          break;
        }
      }
      if (sSample === undefined) sSample = 0;
    }

    const res = processMeasurement(sSample, Q, selectedN, selectedA, truePeriod);
    setMeasurement(res);
    setCurrentStep(3);
  };

  // Plain-English live caption
  const liveCaption = useMemo(() => {
    if (hasSharedFactor) {
      return `Because gcd(${selectedA}, ${selectedN}) = ${classicalGcd} > 1, the number ${selectedA} shares a factor with ${selectedN}. Shor's algorithm checks this classically before running the quantum circuit and terminates immediately!`;
    }
    switch (currentStep) {
      case 1:
        return `Step 1 (Modular Arithmetic): We compute f(x) = ${selectedA}^x mod ${selectedN}. Notice that the outputs repeat periodically every r = ${truePeriod} steps. A classical computer must evaluate points one-by-one; a quantum computer evaluates all inputs in superposition.`;
      case 2:
        return `Step 2 (Quantum Fourier Transform): The QFT converts periodic superposition in time into constructive interference in frequency. Peaks appear precisely around integer multiples of Q/r = ${Q}/${truePeriod} = ${(Q / truePeriod).toFixed(1)}.`;
      case 3:
        return measurement
          ? `Step 3 (Measurement & Continued Fractions): You measured state s = ${measurement.s}. Computing continued fractions on s/Q = ${measurement.fractionStr} gives candidate period r = ${measurement.candidateR}. ${measurement.message}`
          : `Step 3: Click 'Sample Quantum Measurement' to collapse the QFT superposition into an observed state 's' and extract candidate period 'r'.`;
      case 4:
        return factorResult.success
          ? `Step 4 (Extracting Prime Factors): Using r = ${factorResult.r}, we compute ${selectedA}^(${factorResult.r}/2) ± 1 = ${modPow(selectedA, (factorResult.r || 2) / 2, selectedN)} ± 1. Classical Euclid's GCD with ${selectedN} yields factors: ${factorResult.factors?.join(' and ')}!`
          : `Step 4: ${factorResult.explanation}`;
      default:
        return '';
    }
  }, [currentStep, selectedA, selectedN, classicalGcd, hasSharedFactor, truePeriod, Q, measurement, factorResult]);

  return (
    <div className="w-full bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-white font-sans">
      {/* Simulation Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Shor&apos;s Algorithm Simulator
          </h2>
        </div>
        <div className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/70">
          Classical simulation of the maths, small numbers only
        </div>
      </div>

      {/* Parameter Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Semiprime n Selector */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-2">
            Target Semiprime (n):
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SEMIPRIME_OPTIONS.map((opt) => (
              <button
                key={opt.n}
                onClick={() => {
                  setSelectedN(opt.n);
                  setSelectedA(opt.bases[0].a);
                }}
                className={`px-3 py-2 text-sm font-semibold rounded-lg border transition-all ${
                  selectedN === opt.n
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                    : 'bg-black/40 text-white/70 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 text-xs text-white/50 font-mono">
            Register size: Q = 2^{q} = {Q} (smallest power of 2 ≥ {selectedN}² = {selectedN * selectedN})
          </div>
        </div>

        {/* Base 'a' Selector */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-2">
            Chosen Base (a) &amp; Edge Cases:
          </label>
          <div className="space-y-1.5">
            {currentNOption.bases.map((baseOpt) => (
              <button
                key={baseOpt.a}
                onClick={() => setSelectedA(baseOpt.a)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between border ${
                  selectedA === baseOpt.a
                    ? 'bg-white/15 text-white border-white/40 shadow-sm'
                    : 'bg-black/30 text-white/60 border-white/5 hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="font-mono font-bold text-sm">a = {baseOpt.a}</span>
                <span className="text-[11px] text-white/70 truncate ml-2">{baseOpt.note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step Stepper & Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 rounded-xl bg-white/[0.04] border border-white/10">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[
            { step: 1, title: '1. Modular Exp' },
            { step: 2, title: '2. QFT Peaks' },
            { step: 3, title: '3. Measurement' },
            { step: 4, title: '4. Factors' },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => setCurrentStep(item.step)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentStep === item.step
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        {/* Play / Step / Reset Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="px-2.5 py-1 text-xs rounded-lg border border-white/15 bg-black/40 text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
          >
            ← Prev
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 transition-all flex items-center gap-1.5"
          >
            {isPlaying ? (
              <>
                <span className="h-2 w-2 rounded-sm bg-emerald-400" />
                Pause
              </>
            ) : (
              <>
                <span className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-6 border-l-emerald-400 inline-block" />
                Play Auto
              </>
            )}
          </button>
          <button
            onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
            disabled={currentStep === 4}
            className="px-2.5 py-1 text-xs rounded-lg border border-white/15 bg-black/40 text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
          >
            Next →
          </button>
          <button
            onClick={() => {
              setCurrentStep(1);
              setMeasurement(null);
              setIsPlaying(false);
            }}
            className="px-2.5 py-1 text-xs rounded-lg border border-white/15 bg-black/40 text-white/50 hover:text-white hover:bg-white/10"
            title="Reset simulation"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Live Plain-English Dynamic Caption */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-black/60 border border-blue-500/20 text-sm leading-relaxed text-blue-100 flex items-start gap-3">
        <span className="text-base shrink-0 mt-0.5">💡</span>
        <div>
          <div className="text-xs uppercase font-mono tracking-wider text-blue-400 font-semibold mb-1">
            Plain-English Insight
          </div>
          <div>{liveCaption}</div>
        </div>
      </div>

      {/* Visual Workspace by Step */}
      <div className="p-4 sm:p-6 rounded-xl bg-black/50 border border-white/10 mb-6 min-h-[280px]">
        {/* Step 1: Modular Exponentiation */}
        {currentStep === 1 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 font-mono">
                Periodic Sequence: f(x) = {selectedA}^x mod {selectedN}
              </h3>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/10 text-white">
                {hasSharedFactor
                  ? `gcd(${selectedA}, ${selectedN}) = ${classicalGcd} > 1`
                  : `Period r = ${truePeriod}`}
              </span>
            </div>

            {hasSharedFactor ? (
              <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-sm">
                <span className="font-bold">Classical Shortcut Triggered:</span> gcd({selectedA}, {selectedN}) ={' '}
                {classicalGcd}. Since this is greater than 1, {classicalGcd} and {selectedN / classicalGcd} are the
                factors of {selectedN}! We don&apos;t even need quantum period finding.
              </div>
            ) : (
              <div>
                <p className="text-xs text-white/60 mb-3">
                  Evaluating f(x) = {selectedA}^x mod {selectedN} produces a repeating pattern of length r ={' '}
                  {truePeriod}:
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 font-mono text-center">
                  {modSequence.map((item) => {
                    const isPeriodBoundary = item.x > 0 && item.x % truePeriod === 0;
                    return (
                      <div
                        key={item.x}
                        className={`p-2.5 rounded-lg border text-xs transition-all ${
                          item.val === 1
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                            : isPeriodBoundary
                            ? 'bg-blue-500/15 border-blue-400/40 text-blue-200'
                            : 'bg-white/5 border-white/10 text-white/70'
                        }`}
                      >
                        <div className="text-[10px] text-white/40">x={item.x}</div>
                        <div className="text-sm font-bold mt-0.5">{item.val}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-xs text-white/50">
                  Notice that {selectedA}^{truePeriod} mod {selectedN} = {modPow(selectedA, truePeriod, selectedN)}.
                  The output returns to 1, confirming the cycle length r = {truePeriod}.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Quantum Fourier Transform Spectrum */}
        {currentStep === 2 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 font-mono">
                QFT Probability Distribution (Q = {Q} States)
              </h3>
              <div className="text-xs font-mono text-white/50">
                Peaks at multiples of Q/r = {Q}/{truePeriod} = {(Q / (truePeriod || 1)).toFixed(1)}
              </div>
            </div>

            {hasSharedFactor ? (
              <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm">
                No quantum register required when gcd(a, n) &gt; 1.
              </div>
            ) : (
              <div>
                <p className="text-xs text-white/60 mb-3">
                  Constructive interference concentrates probability into distinct frequency spikes:
                </p>

                {/* SVG Frequency Spectrum Chart */}
                <div className="w-full bg-black/80 rounded-xl border border-white/10 p-3 sm:p-4 overflow-x-auto shadow-inner">
                  <svg
                    viewBox="0 0 800 170"
                    className="w-full min-w-[560px] h-44 select-none"
                  >
                    <defs>
                      <linearGradient id="qftExactGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                      <linearGradient id="qftSpreadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                      <filter id="qftGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Horizontal baseline */}
                    <line x1="30" y1="135" x2="770" y2="135" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

                    {/* Guide dashed lines */}
                    <line x1="30" y1="85" x2="770" y2="85" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="30" y1="35" x2="770" y2="35" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" strokeWidth="1" />

                    {/* X-axis key boundary ticks */}
                    <text x="35" y="155" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">s = 0</text>
                    <text x="400" y="155" fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="monospace" textAnchor="middle">s = {Math.round(Q / 2)}</text>
                    <text x="765" y="155" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace" textAnchor="end">s = {Q - 1}</text>

                    {/* Spikes / Bars */}
                    {(() => {
                      const maxP = Math.max(...peakData.map((d) => d.prob), 0.05);
                      const rDividesQ = truePeriod > 0 && Q % truePeriod === 0;

                      return peakData.map((pk) => {
                        // X coordinate scaled from s in [0, Q-1] to [40, 760]
                        const xCenter = 40 + (pk.s / (Q - 1 || 1)) * 720;
                        const barW = rDividesQ ? 22 : Math.max(5, Math.min(10, 720 / (peakData.length * 1.5)));
                        const x = xCenter - barW / 2;

                        // Bar height scaled to 95px max
                        const barH = Math.min(105, Math.max(14, (pk.prob / maxP) * 95));
                        const y = 135 - barH;

                        return (
                          <g
                            key={pk.s}
                            onClick={() => handleMeasure(pk.s)}
                            className="cursor-pointer group"
                          >
                            <title>{`State s = ${pk.s}, P(s) = ${(pk.prob * 100).toFixed(2)}%`}</title>

                            {/* Click target hit-box */}
                            <rect
                              x={xCenter - 15}
                              y={20}
                              width={30}
                              height={125}
                              fill="transparent"
                            />

                            {/* Visible Spike */}
                            <rect
                              x={x}
                              y={y}
                              width={barW}
                              height={barH}
                              rx={3}
                              ry={3}
                              fill={pk.isMultiple ? 'url(#qftExactGradient)' : 'url(#qftSpreadGradient)'}
                              filter={pk.isMultiple ? 'url(#qftGlow)' : undefined}
                              className="transition-all duration-200 group-hover:brightness-125"
                            />

                            {/* Percentage label above peak */}
                            {(pk.prob > 0.04 || rDividesQ) && (
                              <text
                                x={xCenter}
                                y={y - 6}
                                fill={pk.isMultiple ? '#34d399' : '#93c5fd'}
                                fontSize="11"
                                fontWeight="bold"
                                fontFamily="monospace"
                                textAnchor="middle"
                              >
                                {(pk.prob * 100).toFixed(1)}%
                              </text>
                            )}

                            {/* State label below baseline */}
                            <text
                              x={xCenter}
                              y={148}
                              fill={pk.isMultiple ? '#ffffff' : 'rgba(255,255,255,0.6)'}
                              fontSize="10"
                              fontWeight={pk.isMultiple ? 'bold' : 'normal'}
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {pk.s}
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      Exact spikes (multiples of Q/r)
                    </span>
                    {!(truePeriod > 0 && Q % truePeriod === 0) && (
                      <span className="flex items-center gap-1.5 text-blue-300 ml-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                        Spread diffraction peaks
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-white/10 text-white font-bold border border-white/15">
                      ∑ Probabilities: {totalProbabilitySum.toFixed(4)} (100.0%)
                    </span>
                    <span className="text-white/40 hidden sm:inline">Click any spike to sample!</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Measurement & Continued Fractions */}
        {currentStep === 3 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 font-mono">
                Step 3: Quantum Measurement &amp; Continued Fractions
              </h3>
              <button
                onClick={() => handleMeasure()}
                className="px-4 py-1.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>⚡</span> Sample Quantum Measurement
              </button>
            </div>

            {measurement ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-white/40">Measured State (s):</div>
                    <div className="text-lg font-bold text-white mt-1">s = {measurement.s}</div>
                    <div className="text-white/50 mt-0.5">Ratio s/Q = {measurement.fractionStr}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-white/40">Continued Fractions:</div>
                    <div className="text-lg font-bold text-cyan-300 mt-1">
                      {measurement.convergent.p} / {measurement.convergent.q}
                    </div>
                    <div className="text-white/50 mt-0.5">Approximates s/Q with denom &lt; {selectedN}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-white/40">Candidate Period (r):</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      r = {measurement.candidateR}
                    </div>
                    <div className="text-white/50 mt-0.5">
                      Check: {selectedA}^{measurement.candidateR} mod {selectedN} ={' '}
                      {modPow(selectedA, measurement.candidateR, selectedN)}
                    </div>
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                    measurement.isValidPeriod
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : measurement.isDivisorOfPeriod
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : 'bg-red-950/40 border-red-500/40 text-red-200'
                  }`}
                >
                  <span className="font-bold mr-1">Result:</span> {measurement.message}
                </div>

                {/* Common Shor partial period explanation */}
                {measurement.isDivisorOfPeriod && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70">
                    <span className="text-white font-semibold">Why this happens:</span> When the measured state{' '}
                    <code className="text-cyan-300">s</code> shares a common factor with <code className="text-cyan-300">r</code> (for example{' '}
                    <code className="text-cyan-300">s = 128</code> when <code className="text-cyan-300">Q = 256, r = 4</code>), the fraction{' '}
                    <code className="text-cyan-300">128/256</code> reduces to <code className="text-cyan-300">1/2</code>. The denominator is 2, which is a divisor of the true period 4. Shor&apos;s algorithm handles this by taking another measurement or testing small multiples!
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-white/50 text-sm">
                Click &quot;Sample Quantum Measurement&quot; above to simulate measuring the quantum register.
              </div>
            )}
          </div>
        )}

        {/* Step 4: Classical Factoring Extraction */}
        {currentStep === 4 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 font-mono">
                Step 4: Classical Post-Processing &amp; Factoring
              </h3>
              <span
                className={`text-xs font-mono px-2.5 py-1 rounded font-bold ${
                  factorResult.success
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {factorResult.success ? 'FACTORS FOUND' : 'RETRY TRIGGERED'}
              </span>
            </div>

            <div
              className={`p-4 rounded-xl border mb-4 text-sm leading-relaxed ${
                factorResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
              }`}
            >
              <div className="font-bold text-base mb-1">
                {factorResult.success ? '🎉 Factorization Completed!' : '⚠️ Algorithm Must Retry'}
              </div>
              <p>{factorResult.explanation}</p>
            </div>

            {factorResult.success && factorResult.factors && (
              <div className="grid grid-cols-2 gap-4 font-mono text-center">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40">Prime Factor p:</div>
                  <div className="text-3xl font-extrabold text-white mt-1">{factorResult.factors[0]}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40">Prime Factor q:</div>
                  <div className="text-3xl font-extrabold text-white mt-1">{factorResult.factors[1]}</div>
                </div>
              </div>
            )}

            {!factorResult.success && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70 space-y-2">
                <div className="text-white font-semibold">How Shor&apos;s handles retries:</div>
                <p>
                  Shor&apos;s algorithm is a probabilistic polynomial-time algorithm (BQP). A single run has at least a{' '}
                  <span className="text-emerald-300 font-semibold">50% to 75%</span> chance of successfully finding non-trivial factors. If an odd period or trivial factor is encountered, the classical driver simply selects another random base <code className="text-white">a</code> and runs the circuit again.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Concept Check Quiz Component */}
      <div className="mt-6 p-4 sm:p-5 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-bold">
            Concept Check
          </span>
        </div>
        <p className="text-sm font-medium text-white mb-3">
          Why can&apos;t Shor&apos;s algorithm proceed when the measured period <code className="text-cyan-300 font-mono">r</code> is odd (like n=21, a=4 giving r=3)?
        </p>

        {(() => {
          const choices = [
            {
              id: 0,
              text: 'The quantum computer overheats and cannot maintain superposition.',
              correct: false,
              why: 'Physical decoherence and thermal noise are hardware engineering challenges, not the algebraic limitation.',
            },
            {
              id: 1,
              text: 'We must evaluate a^(r/2) ± 1; if r is odd, r/2 is not an integer so modular exponentiation cannot form integer factors.',
              correct: true,
              why: 'Shor relies on difference of squares: a^r - 1 = (a^(r/2) - 1)(a^(r/2) + 1) ≡ 0 (mod n). This algebraically requires r/2 to be an integer.',
            },
            {
              id: 2,
              text: 'Odd numbers cannot be factored into primes.',
              correct: false,
              why: 'Every odd composite number (like 21 = 3 × 7 or 35 = 5 × 7) is factored into odd primes.',
            },
          ];

          return (
            <>
              <div className="space-y-2 mb-3">
                {choices.map((choice) => {
                  let btnStyle = 'bg-black/30 border-white/10 text-white/70 hover:bg-white/5 hover:text-white';
                  if (showExplanation) {
                    if (choice.correct) {
                      btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold';
                    } else if (activeQuizAnswer === choice.id) {
                      btnStyle = 'bg-red-950/60 border-red-500 text-red-200';
                    } else {
                      btnStyle = 'bg-black/20 border-white/5 text-white/40 opacity-50';
                    }
                  }

                  return (
                    <button
                      key={choice.id}
                      disabled={showExplanation}
                      onClick={() => {
                        setActiveQuizAnswer(choice.id);
                        setShowExplanation(true);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-all border ${btnStyle}`}
                    >
                      {choice.text}
                    </button>
                  );
                })}
              </div>

              {showExplanation && activeQuizAnswer !== null && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 space-y-2">
                  <div>
                    {choices[activeQuizAnswer].correct ? (
                      <span className="text-emerald-300 font-semibold">✓ Correct explanation: </span>
                    ) : (
                      <span className="text-red-400 font-semibold">✗ Why that choice is mistaken: </span>
                    )}
                    {choices[activeQuizAnswer].why}
                  </div>

                  <button
                    onClick={() => {
                      setActiveQuizAnswer(null);
                      setShowExplanation(false);
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

      {/* One-Sentence Term Definitions */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono text-white/60">
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
          <span className="text-white font-bold block mb-0.5">Superposition</span>
          A quantum state representing a simultaneous linear combination of all computational basis values.
        </div>
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
          <span className="text-white font-bold block mb-0.5">QFT</span>
          Quantum Fourier Transform: transforms time-domain periodic state amplitudes into frequency-domain interference peaks.
        </div>
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
          <span className="text-white font-bold block mb-0.5">Period (r)</span>
          The smallest positive integer such that a^r ≡ 1 (mod n), which Shor&apos;s algorithm finds in polynomial time.
        </div>
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
          <span className="text-white font-bold block mb-0.5">Continued Fractions</span>
          Classical method to recover rational approximations p/q to phase s/Q with denominator q &lt; n.
        </div>
      </div>
    </div>
  );
}
