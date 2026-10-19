'use client';

import React, { useState, useMemo } from 'react';
import {
  calculateMoscaRisk,
  inferCriticalityHeuristically,
  QuantumStatus,
  BusinessCriticality,
  ExposureTag,
  MoscaRiskResult,
} from '@/lib/learn/risk_engine';

interface PresetScenario {
  id: string;
  name: string;
  description: string;
  X: number; // Shelf-life
  Y: number; // Migration
  Z: number; // Quantum arrival
  algo: string;
  quantumStatus: QuantumStatus;
  criticality: BusinessCriticality;
  exposure: ExposureTag;
  path: string;
}

// Neutral illustrative scenario presets (no specific regulation claims)
const PRESETS: PresetScenario[] = [
  {
    id: 'healthcare',
    name: 'Patient records (Illustrative scenario)',
    description: 'Can stay sensitive for decades. Long-term confidentiality needed.',
    X: 25,
    Y: 6,
    Z: 12,
    algo: 'RSA-2048',
    quantumStatus: 'shor_vulnerable',
    criticality: 'critical',
    exposure: 'external',
    path: 'backend/ehr/patient_records/keys.pem',
  },
  {
    id: 'financial',
    name: 'Financial transaction logs (Illustrative scenario)',
    description: 'Retained for multi-year audit and operational review.',
    X: 10,
    Y: 4,
    Z: 12,
    algo: 'AES-128-GCM',
    quantumStatus: 'grover_weakened',
    criticality: 'high',
    exposure: 'internal',
    path: 'services/ledger/storage.py',
  },
  {
    id: 'ephemeral',
    name: 'Ephemeral web session (Illustrative scenario)',
    description: 'Short-lived tokens and transient sessions with rapid turnover.',
    X: 1,
    Y: 2,
    Z: 12,
    algo: 'ECDSA-P256',
    quantumStatus: 'shor_vulnerable',
    criticality: 'medium',
    exposure: 'external',
    path: 'app/controllers/session.go',
  },
];

export default function MoscaSimulator() {
  const [shelfLifeX, setShelfLifeX] = useState<number>(10);
  const [migrationY, setMigrationY] = useState<number>(5);
  const [quantumZ, setQuantumZ] = useState<number>(12);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Risk Engine parameters
  const [algoName, setAlgoName] = useState<string>('RSA-2048');
  const [quantumStatus, setQuantumStatus] = useState<QuantumStatus>('shor_vulnerable');
  const [criticality, setCriticality] = useState<BusinessCriticality>('critical');
  const [exposure, setExposure] = useState<ExposureTag>('internal');
  const [samplePath, setSamplePath] = useState<string>('backend/auth/jwt_keys/private.pem');

  // Quiz state
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [showQuizResult, setShowQuizResult] = useState<boolean>(false);

  // Mosca Inequality calculation
  const totalNeed = shelfLifeX + migrationY;
  const deficit = totalNeed - quantumZ;
  const isViolated = totalNeed > quantumZ;
  const isImmediateHarvestRisk = shelfLifeX > quantumZ;

  // Live calculation from TypeScript mirror of backend/app/services/risk_engine.py
  const riskResult: MoscaRiskResult = useMemo(() => {
    return calculateMoscaRisk({
      name: algoName,
      path: samplePath,
      algo_type:
        algoName.toLowerCase().includes('rsa') || algoName.toLowerCase().includes('ecdsa')
          ? 'key'
          : 'algorithm',
      quantum_status: quantumStatus,
      business_criticality: criticality,
      shelf_life_years: shelfLifeX,
      migration_time_years: migrationY,
      quantum_arrival_years: quantumZ,
      exposure_tag: exposure,
    });
  }, [algoName, samplePath, quantumStatus, criticality, shelfLifeX, migrationY, quantumZ, exposure]);

  // Load preset
  const handleSelectPreset = (p: PresetScenario) => {
    setActivePreset(p.id);
    setShelfLifeX(p.X);
    setMigrationY(p.Y);
    setQuantumZ(p.Z);
    setAlgoName(p.algo);
    setQuantumStatus(p.quantumStatus);
    setCriticality(p.criticality);
    setExposure(p.exposure);
    setSamplePath(p.path);
  };

  // Plain-English live caption computed with exact user-requested logic
  const dynamicCaption = useMemo(() => {
    if (isViolated) {
      let text = `Data encrypted with legacy crypto right up to the end of migration (year ${migrationY}) must stay secret until year ${totalNeed}, but a quantum computer arrives in year ${quantumZ}, so the last ${deficit} year${
        deficit === 1 ? '' : 's'
      } of that data's required lifetime are exposed. Why Y matters: until migration finishes, new data is still encrypted with vulnerable crypto.`;

      if (isImmediateHarvestRisk) {
        text += ` Data harvested today is already at risk: it must stay secret ${shelfLifeX} years but can be decrypted in ${quantumZ} years.`;
      }
      return text;
    }
    return `Within safe migration window: X + Y (${totalNeed} years) ≤ Z (${quantumZ} years). All legacy data will have expired its required confidentiality lifetime before a quantum computer arrives, and migration completes with time to spare.`;
  }, [isViolated, isImmediateHarvestRisk, migrationY, totalNeed, quantumZ, deficit, shelfLifeX]);

  // Quiz choices with individual sentence explanations for why wrong
  const quizChoices = [
    {
      id: 0,
      text: 'Adversaries intercept and archive the ciphertext today. In 12 years when CRQC arrives, they decrypt it — while the patient data still has 3 years of required sensitivity remaining.',
      correct: true,
      explanation:
        'Because X (15) > Z (12), ciphertext harvested today will still be confidential when a quantum computer arrives in year 12, leaving 3 years of active sensitivity exposed.',
    },
    {
      id: 1,
      text: 'Classical servers automatically halt cryptographic operations when quantum computers are expected.',
      correct: false,
      explanation:
        'Classical servers have no awareness of future quantum hardware and will continue encrypting data with vulnerable algorithms.',
    },
    {
      id: 2,
      text: 'Quantum decoherence causes physical damage to encrypted magnetic disks over long timeframes.',
      correct: false,
      explanation:
        'Quantum decoherence is a quantum processor constraint; stored ciphertext on standard disks suffers no physical corruption from future quantum machines.',
    },
  ];

  return (
    <div className="w-full bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-white font-sans">
      {/* Module Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#f59e0b]" />
          <h2
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Mosca&apos;s Inequality &amp; Risk Engine
          </h2>
        </div>
        <div className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/70">
          Direct Mirror of backend/app/services/risk_engine.py
        </div>
      </div>

      {/* Preset Scenarios */}
      <div className="mb-6">
        <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-2">
          Illustrative Scenarios:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectPreset(p)}
              className={`p-3 rounded-xl border text-left transition-all ${
                activePreset === p.id
                  ? 'bg-white/15 border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                  : 'bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="font-semibold text-xs text-white mb-1 flex items-center justify-between">
                <span>{p.name}</span>
                {activePreset === p.id && <span className="text-[10px] text-amber-300 font-mono">Active</span>}
              </div>
              <div className="text-[11px] text-white/50 leading-relaxed">{p.description}</div>
              <div className="mt-2 text-[10px] font-mono text-white/40">
                X={p.X}y · Y={p.Y}y · Z={p.Z}y
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Sliders for X, Y, Z */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Slider X */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-white/60">Shelf-Life (X)</span>
            <span className="text-base font-bold text-cyan-300 font-mono">{shelfLifeX} yrs</span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            value={shelfLifeX}
            onChange={(e) => {
              setShelfLifeX(Number(e.target.value));
              setActivePreset(null);
            }}
            className="w-full accent-cyan-400 bg-white/10 h-1.5 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-white/40 mt-2">
            Required lifetime: how long data must stay secret.
          </p>
        </div>

        {/* Slider Y */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-white/60">Migration Time (Y)</span>
            <span className="text-base font-bold text-amber-300 font-mono">{migrationY} yrs</span>
          </div>
          <input
            type="range"
            min={1}
            max={15}
            value={migrationY}
            onChange={(e) => {
              setMigrationY(Number(e.target.value));
              setActivePreset(null);
            }}
            className="w-full accent-amber-400 bg-white/10 h-1.5 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-white/40 mt-2">
            Years to re-architect systems and migrate keys to PQC.
          </p>
        </div>

        {/* Slider Z */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-white/60">Quantum Arrival (Z)</span>
            <span className="text-base font-bold text-purple-300 font-mono">{quantumZ} yrs</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            value={quantumZ}
            onChange={(e) => {
              setQuantumZ(Number(e.target.value));
              setActivePreset(null);
            }}
            className="w-full accent-purple-400 bg-white/10 h-1.5 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-white/40 mt-2">
            Estimated years until a cryptanalytically relevant quantum computer (CRQC).
          </p>
        </div>
      </div>

      {/* Redesigned Mosca Timeline Bar (Every label distinct and legible) */}
      <div className="p-5 rounded-xl bg-black/60 border border-white/10 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/80">
            Mosca Timeline Comparison: (X + Y) vs Z
          </h3>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
              isViolated
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {isViolated ? `INEQUALITY VIOLATED: DEFICIT +${deficit}Y` : `WITHIN SAFE WINDOW: MARGIN ${Math.abs(deficit)}Y`}
          </span>
        </div>

        {/* Distinct Segment Header Badges (Always legible on laptop and mobile) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 font-mono text-xs">
          <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-200">
            <span className="text-[10px] text-cyan-400 block font-semibold">SEGMENT 1: SHELF-LIFE (X)</span>
            <span className="font-bold text-sm">{shelfLifeX} years</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200">
            <span className="text-[10px] text-amber-400 block font-semibold">SEGMENT 2: MIGRATION (Y)</span>
            <span className="font-bold text-sm">{migrationY} years</span>
          </div>
          <div className="col-span-2 sm:col-span-1 p-2 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-200">
            <span className="text-[10px] text-purple-400 block font-semibold">CRQC ARRIVAL (Z)</span>
            <span className="font-bold text-sm">{quantumZ} years</span>
          </div>
        </div>

        {/* Dual Stacked Progress Bars with No Overlapping Labels */}
        <div className="space-y-4 font-mono text-xs">
          {/* Bar 1: X + Y needed */}
          <div>
            <div className="flex justify-between text-white/50 text-[11px] mb-1">
              <span>Total Required Timeline: X + Y = {totalNeed} years</span>
              <span>{totalNeed}y</span>
            </div>
            <div className="w-full bg-white/5 h-7 rounded-lg overflow-hidden flex border border-white/10">
              <div
                style={{ width: `${Math.min(100, (shelfLifeX / Math.max(35, totalNeed, quantumZ)) * 100)}%` }}
                className="bg-cyan-500/90 text-black font-bold text-xs flex items-center justify-center truncate px-2"
                title={`Shelf-life X = ${shelfLifeX}y`}
              >
                X = {shelfLifeX}y
              </div>
              <div
                style={{ width: `${Math.min(100, (migrationY / Math.max(35, totalNeed, quantumZ)) * 100)}%` }}
                className="bg-amber-500/90 text-black font-bold text-xs flex items-center justify-center truncate px-2"
                title={`Migration Y = ${migrationY}y`}
              >
                Y = {migrationY}y
              </div>
            </div>
          </div>

          {/* Bar 2: Quantum Arrival Z and Deficit Track */}
          <div>
            <div className="flex justify-between text-white/50 text-[11px] mb-1">
              <span>Time Until Quantum Decryption (Z) vs Exposure Deficit</span>
              <span>{quantumZ}y</span>
            </div>
            <div className="w-full bg-white/5 h-7 rounded-lg overflow-hidden flex border border-white/10">
              <div
                style={{ width: `${Math.min(100, (quantumZ / Math.max(35, totalNeed, quantumZ)) * 100)}%` }}
                className="bg-purple-500/90 text-white font-bold text-xs flex items-center justify-center truncate px-2"
                title={`Quantum Arrival Z = ${quantumZ}y`}
              >
                Z = {quantumZ}y
              </div>
              {isViolated && (
                <div
                  style={{ width: `${Math.min(100, (deficit / Math.max(35, totalNeed, quantumZ)) * 100)}%` }}
                  className="bg-red-500/80 text-white font-bold text-xs flex items-center justify-center truncate px-2 animate-pulse border-l border-red-300"
                  title={`Deficit = ${deficit}y exposed`}
                >
                  +{deficit}y Deficit
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-white/10 text-[11px] text-white/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-cyan-400" /> Shelf-Life (X)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-amber-400" /> Migration Time (Y)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-purple-400" /> Quantum Arrival (Z)
          </span>
          {isViolated && (
            <span className="flex items-center gap-1.5 text-red-300 font-semibold">
              <span className="h-2.5 w-2.5 rounded bg-red-500 animate-pulse" /> Exposed Deficit Window
            </span>
          )}
        </div>
      </div>

      {/* Dynamic Plain-English Caption (Item 1 logic) */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-black/60 border border-amber-500/20 text-sm leading-relaxed text-amber-100 flex items-start gap-3">
        <span className="text-base shrink-0 mt-0.5">⚠️</span>
        <div>
          <div className="text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold mb-1">
            Harvest Now, Decrypt Later (HNDL) Reality
          </div>
          <div>{dynamicCaption}</div>
        </div>
      </div>

      {/* Risk Engine Weights & Score Breakdown */}
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/80">
            ECDAT Risk Engine Mirror (backend/app/services/risk_engine.py)
          </h3>
          <span className="text-xs font-mono text-white/50">Client-side instant calculation</span>
        </div>

        {/* Controls to tweak algorithm & asset attributes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs font-mono">
          <div>
            <label className="text-white/50 block mb-1">Algorithm:</label>
            <select
              value={algoName}
              onChange={(e) => {
                const val = e.target.value;
                setAlgoName(val);
                if (val.includes('RSA') || val.includes('ECDSA')) setQuantumStatus('shor_vulnerable');
                else if (val.includes('AES-128')) setQuantumStatus('grover_weakened');
                else if (val.includes('MD5')) setQuantumStatus('classically_broken');
                else setQuantumStatus('quantum_safe');
              }}
              className="w-full bg-black border border-white/20 rounded p-1.5 text-white"
            >
              <option value="RSA-2048">RSA-2048 (Shor)</option>
              <option value="ECDSA-P256">ECDSA-P256 (Shor)</option>
              <option value="AES-128-GCM">AES-128-GCM (Grover)</option>
              <option value="AES-256-GCM">AES-256-GCM (Safe)</option>
              <option value="MD5">MD5 (Classically Broken)</option>
              <option value="ML-KEM-768">ML-KEM-768 (PQC)</option>
            </select>
          </div>

          <div>
            <label className="text-white/50 block mb-1">Quantum Status:</label>
            <select
              value={quantumStatus}
              onChange={(e) => setQuantumStatus(e.target.value as QuantumStatus)}
              className="w-full bg-black border border-white/20 rounded p-1.5 text-white"
            >
              <option value="shor_vulnerable">shor_vulnerable</option>
              <option value="grover_weakened">grover_weakened</option>
              <option value="classically_broken">classically_broken</option>
              <option value="quantum_safe">quantum_safe</option>
            </select>
          </div>

          <div>
            <label className="text-white/50 block mb-1">Criticality:</label>
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value as BusinessCriticality)}
              className="w-full bg-black border border-white/20 rounded p-1.5 text-white"
            >
              <option value="critical">critical (1.0)</option>
              <option value="high">high (0.75)</option>
              <option value="medium">medium (0.50)</option>
              <option value="low">low (0.25)</option>
            </select>
          </div>

          <div>
            <label className="text-white/50 block mb-1">Exposure Tag:</label>
            <select
              value={exposure}
              onChange={(e) => setExposure(e.target.value as ExposureTag)}
              className="w-full bg-black border border-white/20 rounded p-1.5 text-white"
            >
              <option value="internal">internal (0.5)</option>
              <option value="external">external (1.0)</option>
            </select>
          </div>
        </div>

        {/* Live Score Display */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
          <div className="p-3 rounded-lg bg-black/50 border border-white/10">
            <div className="text-[10px] text-white/40">VERDICT</div>
            <div className="text-sm font-bold text-white mt-1 capitalize">
              {riskResult.verdict.replace('_', ' ')}
            </div>
            <div className="text-[10px] text-white/50 mt-0.5">margin: {riskResult.margin}y</div>
          </div>

          <div className="p-3 rounded-lg bg-black/50 border border-white/10">
            <div className="text-[10px] text-white/40">RISK LEVEL</div>
            <div
              className={`text-sm font-bold mt-1 uppercase ${
                riskResult.risk_level === 'critical'
                  ? 'text-red-400'
                  : riskResult.risk_level === 'high'
                  ? 'text-amber-400'
                  : riskResult.risk_level === 'medium'
                  ? 'text-yellow-300'
                  : 'text-emerald-400'
              }`}
            >
              {riskResult.risk_level}
            </div>
            <div className="text-[10px] text-white/50 mt-0.5">criticality weight</div>
          </div>

          <div className="p-3 rounded-lg bg-black/50 border border-white/10">
            <div className="text-[10px] text-white/40">PRIORITY SCORE</div>
            <div className="text-2xl font-black text-white mt-0.5">{riskResult.priority_score}</div>
            <div className="text-[10px] text-white/50 mt-0.5">Scale: 0 - 100</div>
          </div>

          <div className="p-3 rounded-lg bg-black/50 border border-white/10 text-left text-[10px] space-y-1">
            <div className="text-white/40 font-bold mb-0.5">FORMULA WEIGHTS:</div>
            <div>w_shor (40%): {riskResult.w_shor.toFixed(2)}</div>
            <div>w_mosca (30%): {riskResult.w_mosca.toFixed(2)}</div>
            <div>w_crit (20%): {riskResult.w_crit.toFixed(2)}</div>
            <div>w_exposure (10%): {riskResult.w_exposure.toFixed(2)}</div>
          </div>
        </div>

        {/* Exact Code Formula Callout (Item 3) */}
        <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono text-white/60 space-y-1">
          <div className="text-white/80 font-bold">Exact backend code formula (risk_engine.py):</div>
          <div>
            w_mosca = min(1.0, max(0.0, (deficit + 5) / 15.0)) for shor_vulnerable when deficit &gt; 0
          </div>
          <div className="text-amber-300">
            For X=10, Y=5, Z=12 (deficit = 3): (3 + 5) / 15.0 = 8 / 15 = 0.5333... → w_mosca = 0.53
          </div>
          <div>
            raw_score = (w_shor * 40.0) + (w_mosca * 30.0) + (w_crit * 20.0) + (w_exposure * 10.0)
          </div>
        </div>
      </div>

      {/* Concept Check Quiz (Item 4 & Item 1 requirement: label patient data X=15, Z=12 as X > Z case) */}
      <div className="p-4 sm:p-5 rounded-xl bg-white/[0.03] border border-white/10 mb-6">
        <div className="text-xs uppercase font-mono tracking-wider text-amber-400 font-bold mb-2">
          Concept Check: Patient Data (X = 15, Z = 12 — The X &gt; Z Case)
        </div>
        <p className="text-sm font-medium text-white mb-3">
          When patient data must remain confidential for 15 years (X = 15) and a quantum computer arrives in 12 years (Z = 12), why is that data vulnerable to Harvest Now, Decrypt Later today?
        </p>

        <div className="space-y-2 mb-3">
          {quizChoices.map((c) => {
            let choiceStyle = 'bg-black/30 border-white/10 text-white/70 hover:bg-white/5 hover:text-white';
            if (showQuizResult) {
              if (c.correct) {
                choiceStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold';
              } else if (quizAnswer === c.id) {
                choiceStyle = 'bg-red-950/60 border-red-500 text-red-200';
              } else {
                choiceStyle = 'bg-black/20 border-white/5 text-white/40 opacity-50';
              }
            }

            return (
              <button
                key={c.id}
                disabled={showQuizResult}
                onClick={() => {
                  setQuizAnswer(c.id);
                  setShowQuizResult(true);
                }}
                className={`w-full text-left p-2.5 rounded-lg text-xs transition-all border ${choiceStyle}`}
              >
                {c.text}
              </button>
            );
          })}
        </div>

        {showQuizResult && quizAnswer !== null && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 space-y-2">
            <div>
              {quizChoices[quizAnswer].correct ? (
                <span className="text-emerald-300 font-semibold">✓ Correct explanation: </span>
              ) : (
                <span className="text-red-400 font-semibold">✗ Why that choice is mistaken: </span>
              )}
              {quizChoices[quizAnswer].explanation}
            </div>

            <button
              onClick={() => {
                setQuizAnswer(null);
                setShowQuizResult(false);
              }}
              className="px-3 py-1 text-xs font-semibold rounded bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Term Definitions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono text-white/60">
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
          <span className="text-white font-bold block mb-0.5">Shelf-Life (X)</span>
          Duration encrypted data must remain confidential before public disclosure causes zero harm.
        </div>
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
          <span className="text-white font-bold block mb-0.5">Migration Time (Y)</span>
          Years required to re-engineer infrastructure, update standards, and replace keys with PQC.
        </div>
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
          <span className="text-white font-bold block mb-0.5">CRQC Arrival (Z)</span>
          Estimated timeline until a Cryptanalytically Relevant Quantum Computer becomes operational.
        </div>
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
          <span className="text-white font-bold block mb-0.5">Mosca Deficit</span>
          The vulnerability window (X + Y - Z) during which historical archives are exposed to decryption.
        </div>
      </div>
    </div>
  );
}
