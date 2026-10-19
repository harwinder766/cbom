/**
 * Pure TypeScript implementation of Grover's Algorithm security metrics.
 * No React or browser dependencies.
 */

export type GroverSecurityStatus = "CLASSICALLY_BROKEN" | "WEAKENED" | "COMFORTABLE";

export interface GroverCalculationResult {
  keyBits: number;
  searchSpaceExact: string; // e.g. "2^128"
  classicalOpsLog2: number; // k
  quantumOpsLog2: number; // k/2
  effectiveSecurityBits: number; // k/2
  status: GroverSecurityStatus;
  statusLabel: string;
  statusColor: string; // Tailored styling indicator
  isParallelizationImpaired: boolean;
  explanation: string;
  recommendation: string;
}

/**
 * Calculate quantum Grover impact on a symmetric key or hash preimage of length k bits.
 * Label numbers "theoretical".
 */
export function calculateGroverImpact(keyBits: number): GroverCalculationResult {
  const classicalOpsLog2 = keyBits;
  const quantumOpsLog2 = keyBits / 2;
  const effectiveSecurityBits = quantumOpsLog2;

  let status: GroverSecurityStatus;
  let statusLabel: string;
  let statusColor: string;
  let explanation: string;
  let recommendation: string;

  if (keyBits <= 64) {
    status = "CLASSICALLY_BROKEN";
    statusLabel = "CLASSICALLY INSECURE";
    statusColor = "#ef4444"; // red
    explanation = `With ${keyBits} bits, the key is already vulnerable to classical brute-force (2^${keyBits} operations). A quantum computer solves it in ~2^${effectiveSecurityBits} theoretical steps, which takes mere seconds on small quantum processors.`;
    recommendation = "Immediately upgrade to AES-256 or modern symmetric standards.";
  } else if (keyBits <= 128) {
    status = "WEAKENED";
    statusLabel = "WEAKENED";
    statusColor = "#f59e0b"; // amber
    explanation = `Key space of 2^${keyBits} provides 128-bit classical security, but Grover's algorithm theoretically searches it in ~2^${effectiveSecurityBits} quantum operations. While 2^64 sequential quantum steps is still a massive effort, it falls within reach of well-funded state actors and high-budget attacks.`;
    recommendation = "Upgrade to AES-256 to restore comfortable 128-bit post-quantum security margin.";
  } else {
    status = "COMFORTABLE";
    statusLabel = "COMFORTABLE / SECURE";
    statusColor = "#10b981"; // green
    explanation = `With ${keyBits} bits, Grover's quadratic speedup reduces effective security to ~2^${effectiveSecurityBits} theoretical quantum operations. 2^${effectiveSecurityBits} operations exceeds the total thermodynamic energy budget of Earth, making exhaustive quantum search physically intractable.`;
    recommendation = "Post-quantum safe for symmetric encryption and hash integrity.";
  }

  return {
    keyBits,
    searchSpaceExact: `2^${keyBits}`,
    classicalOpsLog2,
    quantumOpsLog2,
    effectiveSecurityBits,
    status,
    statusLabel,
    statusColor,
    isParallelizationImpaired: true,
    explanation,
    recommendation,
  };
}

/**
 * Plain-English note regarding Grover's parallelization limit.
 */
export const GROVER_PARALLELIZATION_NOTE = `Note: Grover's algorithm parallelizes poorly compared to classical brute force. Running S parallel quantum processors only speeds up the attack by a factor of √S (not S). Thus, running 1,000,000 quantum machines in parallel only reduces time by ~1,000x, making actual attacks far more expensive than the naive 2^(k/2) figure suggests. This is why doubling key length to AES-256 (providing 2^128 theoretical resistance) is universally considered completely secure against quantum adversaries.`;
