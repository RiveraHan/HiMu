import assert from "node:assert/strict";
import {
  BenchmarkSpendLedger,
  evaluatePromotion,
} from "./creative-benchmark-core.ts";

const ledger = new BenchmarkSpendLedger(3);
ledger.reserve("text-a", 0.25);
ledger.reserve("image-a", 0.04);
ledger.complete("text-a", 0.18);
assert.deepEqual(ledger.summary(), {
  limitUsd: 3,
  reservedUsd: 0.29,
  actualUsd: 0.18,
  remainingUsd: 2.71,
  completed: 1,
});
assert.throws(() => ledger.reserve("too-expensive", 2.72), /budget/i);
assert.throws(() => ledger.reserve("image-a", 0.01), /duplicate/i);
assert.throws(() => ledger.complete("image-a", 0.05), /reserved/i);

const promoted = evaluatePromotion({
  baseline: {
    qualityByLocale: { en: [0.6, 0.65], es: [0.58, 0.62] },
    categoryScores: { originality: 0.6, coherence: 0.62, localization: 0.6 },
    costUsd: 0.04,
    latencySeconds: 10,
    failures: 0,
  },
  candidate: {
    qualityByLocale: { en: [0.74, 0.76], es: [0.7, 0.73] },
    categoryScores: { originality: 0.72, coherence: 0.75, localization: 0.7 },
    costUsd: 0.025,
    latencySeconds: 12,
    failures: 0,
  },
});
assert.equal(promoted.promote, true);
assert.deepEqual(promoted.reasons, []);

const rejected = evaluatePromotion({
  baseline: {
    qualityByLocale: { en: [0.7], es: [0.7] },
    categoryScores: { originality: 0.7, coherence: 0.7 },
    costUsd: 0.025,
    latencySeconds: 8,
    failures: 0,
  },
  candidate: {
    qualityByLocale: { en: [0.82], es: [0.68] },
    categoryScores: { originality: 0.82, coherence: 0.64 },
    costUsd: 0.03,
    latencySeconds: 11,
    failures: 1,
  },
});
assert.equal(rejected.promote, false);
assert.ok(rejected.reasons.includes("locale_es_quality"));
assert.ok(rejected.reasons.includes("category_coherence_regression"));
assert.ok(rejected.reasons.includes("cost"));
assert.ok(rejected.reasons.includes("latency"));
assert.ok(rejected.reasons.includes("failures"));

console.log("creative benchmark checks passed");
