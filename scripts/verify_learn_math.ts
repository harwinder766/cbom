import {
  getRegisterSize,
  findTruePeriod,
  computeQFTDistribution,
  continuedFractions,
  processMeasurement,
  factorizeWithPeriod,
  gcd,
  modPow
} from "../lib/learn/shor";
import { calculateGroverImpact, GROVER_PARALLELIZATION_NOTE } from "../lib/learn/grover";

console.log("=== SHOR'S ALGORITHM VERIFICATION ===\n");

// Case 1: n=15, a=2 (Expected: Q=256, r=4, factors 3 and 5)
console.log("--- Case 1: n=15, a=2 ---");
const reg15 = getRegisterSize(15);
console.log(`n=15 -> Q = ${reg15.Q} (q = ${reg15.q})`);
const r15_2 = findTruePeriod(2, 15);
console.log(`True period r = ${r15_2}`);
const qft15_2 = computeQFTDistribution(15, 2, reg15.Q, r15_2);
const peaks15_2: number[] = [];
for (let s = 0; s < reg15.Q; s++) {
  if (qft15_2[s] > 0.05) peaks15_2.push(s);
}
console.log(`QFT Peaks (prob > 0.05): [${peaks15_2.join(", ")}] (Multiples of Q/r = 256/4 = 64)`);

// Test measurement of peak s=64
const meas64 = processMeasurement(64, reg15.Q, 15, 2, r15_2);
console.log(`Measurement at s=64: s/Q = 64/256 = ${meas64.convergent.p}/${meas64.convergent.q} -> Candidate r = ${meas64.candidateR}`);
console.log(`Valid period check: ${meas64.isValidPeriod} (${meas64.message})`);

// Test measurement of peak s=128 (divisor of r)
const meas128 = processMeasurement(128, reg15.Q, 15, 2, r15_2);
console.log(`Measurement at s=128: s/Q = 128/256 = ${meas128.convergent.p}/${meas128.convergent.q} -> Candidate r = ${meas128.candidateR}`);
console.log(`Divisor check: isValid=${meas128.isValidPeriod}, isDivisor=${meas128.isDivisorOfPeriod} -> "${meas128.message}"`);

const fact15_2 = factorizeWithPeriod(15, 2, r15_2);
console.log(`Factorization: success=${fact15_2.success}, factors=${JSON.stringify(fact15_2.factors)}`);
console.log(`Explanation: ${fact15_2.explanation}\n`);


// Case 2: n=21, a=4 (Expected: Q=512, odd period r=3)
console.log("--- Case 2: n=21, a=4 (Odd Period Failure) ---");
const reg21 = getRegisterSize(21);
console.log(`n=21 -> Q = ${reg21.Q} (q = ${reg21.q})`);
const r21_4 = findTruePeriod(4, 21);
console.log(`True period r = ${r21_4}`);
const fact21_4 = factorizeWithPeriod(21, 4, r21_4);
console.log(`Factorization: success=${fact21_4.success}, failureReason=${fact21_4.failureReason}`);
console.log(`Explanation: ${fact21_4.explanation}\n`);


// Case 3: n=15, a=14 (Expected: r=2, a^(r/2) ≡ -1 mod 15, Trivial Factor)
console.log("--- Case 3: n=15, a=14 (Trivial Factor Failure) ---");
const r15_14 = findTruePeriod(14, 15);
console.log(`True period r = ${r15_14}, a^(r/2) mod 15 = 14^1 mod 15 = ${modPow(14, 1, 15)} (≡ -1 mod 15)`);
const fact15_14 = factorizeWithPeriod(15, 14, r15_14);
console.log(`Factorization: success=${fact15_14.success}, failureReason=${fact15_14.failureReason}`);
console.log(`Explanation: ${fact15_14.explanation}\n`);


// Case 4: n=15, a=3 (Expected: gcd(3, 15) = 3 > 1, Shared Factor Classical Shortcut)
console.log("--- Case 4: n=15, a=3 (Shared Factor Shortcut) ---");
console.log(`gcd(3, 15) = ${gcd(3, 15)}`);
const fact15_3 = factorizeWithPeriod(15, 3);
console.log(`Factorization: success=${fact15_3.success}, factors=${JSON.stringify(fact15_3.factors)}`);
console.log(`Explanation: ${fact15_3.explanation}\n`);


// Case 5: n=35 tests (Q=2048)
console.log("--- Case 5: n=35 tests ---");
const reg35 = getRegisterSize(35);
console.log(`n=35 -> Q = ${reg35.Q} (q = ${reg35.q})`);

// 5a. a=6 (r=2, divides Q=2048 -> exactly 2 spikes at 0 and 1024)
const r35_6 = findTruePeriod(6, 35);
const qft35_6 = computeQFTDistribution(35, 6, reg35.Q, r35_6);
const peaks35_6: number[] = [];
for (let s = 0; s < reg35.Q; s++) {
  if (qft35_6[s] > 0.05) peaks35_6.push(s);
}
console.log(`n=35, a=6: period r = ${r35_6}, exact spikes: [${peaks35_6.join(", ")}] (count = ${peaks35_6.length})`);

// 5b. a=2 (r=12, does NOT divide Q=2048 -> spread peaks around multiples of 2048/12 = 170.67)
const r35_2 = findTruePeriod(2, 35);
const qft35_2 = computeQFTDistribution(35, 2, reg35.Q, r35_2);
const peaks35_2: number[] = [];
for (let s = 0; s < reg35.Q; s++) {
  if (qft35_2[s] > 0.01) peaks35_2.push(s);
}
console.log(`n=35, a=2: period r = ${r35_2}, spread peaks count = ${peaks35_2.length} (distribution clustered around multiples of 170.67)`);

// 5c. a=34 (trivial factor failure: 34 = -1 mod 35, r=2, 34^1 = 34 = -1 mod 35)
const r35_34 = findTruePeriod(34, 35);
const fact35_34 = factorizeWithPeriod(35, 34, r35_34);
console.log(`n=35, a=34: period r = ${r35_34}, success=${fact35_34.success}, failureReason=${fact35_34.failureReason}`);
console.log(`Explanation: ${fact35_34.explanation}\n`);


console.log("=== GROVER'S ALGORITHM VERIFICATION ===\n");
const grover128 = calculateGroverImpact(128);
console.log("--- k = 128 ---");
console.log(`Key length: ${grover128.keyBits} bits`);
console.log(`Search space: ${grover128.searchSpaceExact}`);
console.log(`Classical operations: ~2^${grover128.classicalOpsLog2}`);
console.log(`Quantum operations (theoretical): ~2^${grover128.quantumOpsLog2}`);
console.log(`Effective security: ${grover128.effectiveSecurityBits} bits`);
console.log(`Status: ${grover128.statusLabel}`);
console.log(`Explanation: ${grover128.explanation}`);
console.log(`Recommendation: ${grover128.recommendation}\n`);

const grover256 = calculateGroverImpact(256);
console.log("--- k = 256 ---");
console.log(`Key length: ${grover256.keyBits} bits`);
console.log(`Search space: ${grover256.searchSpaceExact}`);
console.log(`Classical operations: ~2^${grover256.classicalOpsLog2}`);
console.log(`Quantum operations (theoretical): ~2^${grover256.quantumOpsLog2}`);
console.log(`Effective security: ${grover256.effectiveSecurityBits} bits`);
console.log(`Status: ${grover256.statusLabel}`);
console.log(`Explanation: ${grover256.explanation}`);
console.log(`Recommendation: ${grover256.recommendation}\n`);

console.log("Grover parallelization note:");
console.log(GROVER_PARALLELIZATION_NOTE);
