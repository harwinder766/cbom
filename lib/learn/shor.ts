/**
 * Pure TypeScript implementation of Shor's Algorithm mathematical simulation.
 * No React or browser dependencies.
 */

export interface ShorInputConfig {
  n: number; // Semiprime (15, 21, 35)
  a: number; // Coprime base or test base
}

export interface QFTPeak {
  s: number;
  prob: number;
  isExactMultiple: boolean;
  idealMultiple?: number;
}

export interface ContinuedFractionConvergent {
  p: number; // numerator
  q: number; // denominator (candidate period)
}

export interface MeasurementResult {
  s: number;
  fractionStr: string;
  convergent: ContinuedFractionConvergent;
  candidateR: number;
  isValidPeriod: boolean;
  isDivisorOfPeriod: boolean;
  message: string;
}

export interface FactorizationResult {
  success: boolean;
  n: number;
  a: number;
  r?: number;
  factors?: [number, number];
  failureReason?: "SHARED_FACTOR_CLASSICAL" | "ODD_PERIOD" | "TRIVIAL_FACTOR";
  explanation: string;
}

/** Compute greatest common divisor */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/** Compute (base^exp) mod m */
export function modPow(base: number, exp: number, m: number): number {
  if (m === 1) return 0;
  let res = 1;
  let b = ((base % m) + m) % m;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) res = (res * b) % m;
    e = Math.floor(e / 2);
    b = (b * b) % m;
  }
  return res;
}

/** Smallest power of 2 >= n^2 */
export function getRegisterSize(n: number): { Q: number; q: number } {
  let q = 1;
  const target = n * n;
  while (Math.pow(2, q) < target) {
    q++;
  }
  return { Q: Math.pow(2, q), q };
}

/** Find the true order r of a mod n, or 0 if gcd(a, n) > 1 */
export function findTruePeriod(a: number, n: number): number {
  if (gcd(a, n) > 1) return 0;
  let r = 1;
  let cur = a % n;
  while (cur !== 1 && r <= n * 2) {
    cur = (cur * a) % n;
    r++;
  }
  return cur === 1 ? r : 0;
}

/**
 * Compute the quantum probability distribution over Q states after QFT.
 * P(s) = (1 / (Q * M)) * | sum_{j=0}^{M-1} e^{2pi * i * j * (s*r) / Q} |^2
 */
export function computeQFTDistribution(n: number, a: number, Q: number, r: number): number[] {
  const probs: number[] = new Array(Q).fill(0);
  if (r <= 0) return probs;

  // Number of elements in superposition for x0 = 0
  const M = Math.floor((Q - 1) / r) + 1;
  const rDividesQ = Q % r === 0;

  for (let s = 0; s < Q; s++) {
    const theta = (2 * Math.PI * ((s * r) % Q)) / Q;
    if (Math.abs(theta) < 1e-9 || Math.abs(theta - 2 * Math.PI) < 1e-9) {
      // Exactly in phase
      probs[s] = (M * M) / (Q * M);
    } else {
      if (rDividesQ) {
        probs[s] = 0;
      } else {
        const sinNumerator = Math.sin((M * theta) / 2);
        const sinDenominator = Math.sin(theta / 2);
        if (Math.abs(sinDenominator) < 1e-12) {
          probs[s] = (M * M) / (Q * M);
        } else {
          const sumSq = Math.pow(sinNumerator / sinDenominator, 2);
          probs[s] = sumSq / (Q * M);
        }
      }
    }
  }

  // Normalize to handle tiny floating point inaccuracies
  const sum = probs.reduce((acc, p) => acc + p, 0);
  if (sum > 0) {
    for (let s = 0; s < Q; s++) {
      probs[s] /= sum;
    }
  }

  return probs;
}

/**
 * Continued fractions expansion of s / Q to recover candidate period r < n.
 */
export function continuedFractions(s: number, Q: number, n: number): ContinuedFractionConvergent {
  if (s === 0) {
    return { p: 0, q: 1 };
  }

  let num = s;
  let den = Q;

  let pPrev2 = 0, pPrev1 = 1;
  let qPrev2 = 1, qPrev1 = 0;

  let bestConvergent: ContinuedFractionConvergent = { p: 0, q: 1 };

  while (den !== 0) {
    const aCoeff = Math.floor(num / den);
    const rem = num % den;

    const pNext = aCoeff * pPrev1 + pPrev2;
    const qNext = aCoeff * qPrev1 + qPrev2;

    if (qNext >= n) {
      break;
    }

    if (qNext > 0) {
      bestConvergent = { p: pNext, q: qNext };
    }

    pPrev2 = pPrev1;
    pPrev1 = pNext;
    qPrev2 = qPrev1;
    qPrev1 = qNext;

    num = den;
    den = rem;
  }

  return bestConvergent;
}

/**
 * Simulate sampling one measurement outcome from the QFT probability distribution.
 */
export function sampleMeasurement(
  distribution: number[],
  sSample?: number
): number {
  if (sSample !== undefined) return sSample;
  const rand = Math.random();
  let cumulative = 0;
  for (let s = 0; s < distribution.length; s++) {
    cumulative += distribution[s];
    if (rand <= cumulative) {
      return s;
    }
  }
  return distribution.length - 1;
}

/**
 * Process a measurement s through continued fractions and check if candidate r works.
 */
export function processMeasurement(
  s: number,
  Q: number,
  n: number,
  a: number,
  truePeriod: number
): MeasurementResult {
  const conv = continuedFractions(s, Q, n);
  const candidateR = conv.q;
  const isValid = candidateR > 0 && modPow(a, candidateR, n) === 1;
  const isDivisor = truePeriod > 0 && candidateR > 0 && truePeriod % candidateR === 0 && candidateR < truePeriod;

  let message = "";
  if (s === 0) {
    message = "Measured s = 0 (phase 0). Yields r = 1, giving no information about the period. Measure again.";
  } else if (isValid) {
    message = `Success! Candidate r = ${candidateR} satisfies ${a}^${candidateR} ≡ 1 (mod ${n}). Period found!`;
  } else if (isDivisor) {
    message = `Check failed: ${a}^${candidateR} mod ${n} = ${modPow(a, candidateR, n)} ≠ 1. However, ${candidateR} divides the true period (${truePeriod}). We got a partial fraction; measure again or test small multiples.`;
  } else {
    message = `Check failed: ${a}^${candidateR} mod ${n} = ${modPow(a, candidateR, n)} ≠ 1. Measurement didn't yield the true period. Measure again.`;
  }

  return {
    s,
    fractionStr: `${s} / ${Q}`,
    convergent: conv,
    candidateR,
    isValidPeriod: isValid,
    isDivisorOfPeriod: isDivisor,
    message,
  };
}

/**
 * Complete Shor classical post-processing given a verified period r (or initial gcd check).
 */
export function factorizeWithPeriod(n: number, a: number, r?: number): FactorizationResult {
  // Step 0: Check classical gcd first
  const initialGcd = gcd(a, n);
  if (initialGcd > 1 && initialGcd < n) {
    const f2 = Math.floor(n / initialGcd);
    return {
      success: true,
      n,
      a,
      factors: [initialGcd, f2],
      failureReason: "SHARED_FACTOR_CLASSICAL",
      explanation: `Classical shortcut: gcd(${a}, ${n}) = ${initialGcd} > 1. We found a factor before running the quantum circuit! Shor's algorithm checks this first.`,
    };
  }

  if (r === undefined || r <= 0) {
    return {
      success: false,
      n,
      a,
      explanation: `No valid period r provided for factorization.`,
    };
  }

  // Step 1: Check if r is odd
  if (r % 2 !== 0) {
    return {
      success: false,
      n,
      a,
      r,
      failureReason: "ODD_PERIOD",
      explanation: `Failure (Odd Period): r = ${r} is odd, so r/2 is not an integer. We cannot compute a^(r/2) ± 1. Shor's algorithm must pick a new random base 'a' and retry.`,
    };
  }

  // Step 2: Compute a^(r/2) mod n
  const halfR = Math.floor(r / 2);
  const x = modPow(a, halfR, n);

  // Step 3: Check if a^(r/2) = -1 mod n (i.e. x = n - 1)
  if (x === n - 1) {
    return {
      success: false,
      n,
      a,
      r,
      failureReason: "TRIVIAL_FACTOR",
      explanation: `Failure (Trivial Factor): ${a}^(${r}/2) ≡ ${x} ≡ -1 (mod ${n}). This yields gcd(${x} + 1, ${n}) = ${n} and gcd(${x} - 1, ${n}) = 1. No new factor discovered. Shor's algorithm must pick a new base 'a' and retry.`,
    };
  }

  // Step 4: Extract factors via GCD
  const f1 = gcd(x - 1, n);
  const f2 = gcd(x + 1, n);

  const factorA = Math.min(f1, f2);
  const factorB = Math.max(f1, f2);

  if (factorA > 1 && factorA < n) {
    const complement = Math.floor(n / factorA);
    const sorted: [number, number] = [Math.min(factorA, complement), Math.max(factorA, complement)];
    return {
      success: true,
      n,
      a,
      r,
      factors: sorted,
      explanation: `Success! r = ${r} (even). ${a}^(${halfR}) mod ${n} = ${x} (≢ -1 mod ${n}). Factors: gcd(${x}-1, ${n}) = ${f1}, gcd(${x}+1, ${n}) = ${f2}. Factors of ${n} are ${sorted[0]} and ${sorted[1]}.`,
    };
  }

  return {
    success: false,
    n,
    a,
    r,
    failureReason: "TRIVIAL_FACTOR",
    explanation: `Could not isolate non-trivial factors from period ${r}. Retry needed.`,
  };
}
