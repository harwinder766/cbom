import { getRegisterSize, findTruePeriod, computeQFTDistribution } from "../lib/learn/shor";

function testCase(n: number, a: number) {
  const { Q, q } = getRegisterSize(n);
  const r = findTruePeriod(a, n);
  const dist = computeQFTDistribution(n, a, Q, r);
  const sum = dist.reduce((acc, p) => acc + p, 0);
  
  const peaks: { s: number; p: number }[] = [];
  for (let s = 0; s < Q; s++) {
    if (dist[s] > 0.01) {
      peaks.push({ s, p: dist[s] });
    }
  }

  console.log(`\n=== n=${n}, a=${a} ===`);
  console.log(`Q = ${Q} (q = ${q}), r = ${r}`);
  console.log(`Probability sum = ${sum.toFixed(6)}`);
  console.log(`Number of peaks (p > 0.01): ${peaks.length}`);
  console.log("Peaks sample:", peaks.slice(0, 8).map(pk => `s=${pk.s}: ${(pk.p * 100).toFixed(2)}%`).join(", "));
  if (peaks.length <= 4) {
    console.log("All peaks:", peaks.map(pk => `s=${pk.s}: ${pk.p}`).join(", "));
  }
}

testCase(15, 2);
testCase(35, 6);
testCase(35, 2);
