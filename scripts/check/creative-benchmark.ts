import assert from "node:assert/strict";
import {
  BenchmarkSpendLedger,
  analyzeRatedComparison,
  buildBlindRatingTemplate,
  buildRatedScorecard,
  evaluatePromotion,
} from "./creative-benchmark-core.ts";
import {
  planTasks,
  scoreBenchmarkLocalization,
  scoreTextBenchmarkSample,
} from "./run-creative-benchmark.ts";

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

const oneShot = evaluatePromotion({
  baseline: {
    qualityByLocale: { en: [0.6], es: [0.6] },
    categoryScores: { originality: 0.6, coherence: 0.6, localization: 0.6 },
    costUsd: 0.04,
    latencySeconds: 10,
    failures: 0,
  },
  candidate: {
    qualityByLocale: { en: [0.76], es: [0.75] },
    categoryScores: { originality: 0.75, coherence: 0.75, localization: 0.75 },
    costUsd: 0.03,
    latencySeconds: 10,
    failures: 0,
  },
});
assert.equal(oneShot.promote, false);
assert.ok(oneShot.reasons.includes("locale_en_samples"));
assert.ok(oneShot.reasons.includes("locale_es_samples"));

const relativelyBetterButMediocre = evaluatePromotion({
  baseline: {
    qualityByLocale: { en: [0.4, 0.4], es: [0.4, 0.4] },
    categoryScores: { originality: 0.45, coherence: 0.45, localization: 0.45 },
    costUsd: 0.04,
    latencySeconds: 10,
    failures: 0,
  },
  candidate: {
    qualityByLocale: { en: [0.5, 0.5], es: [0.51, 0.5] },
    categoryScores: { originality: 0.75, coherence: 0.75, localization: 0.75 },
    costUsd: 0.03,
    latencySeconds: 10,
    failures: 0,
  },
});
assert.equal(relativelyBetterButMediocre.promote, false);
assert.ok(relativelyBetterButMediocre.reasons.includes("locale_en_floor"));
assert.ok(relativelyBetterButMediocre.reasons.includes("locale_es_floor"));

const unstableCandidate = evaluatePromotion({
  baseline: {
    qualityByLocale: { en: [0.6, 0.6], es: [0.6, 0.6] },
    categoryScores: { originality: 0.6, coherence: 0.6, localization: 0.6 },
    costUsd: 0.04,
    latencySeconds: 10,
    failures: 0,
  },
  candidate: {
    qualityByLocale: { en: [0.9, 0.55], es: [0.73, 0.73] },
    categoryScores: { originality: 0.75, coherence: 0.75, localization: 0.75 },
    costUsd: 0.03,
    latencySeconds: 10,
    failures: 0,
  },
});
assert.equal(unstableCandidate.promote, false);
assert.ok(unstableCandidate.reasons.includes("locale_en_consistency"));
assert.equal(unstableCandidate.reasons.includes("locale_es_consistency"), false);

const weakCreativeDimension = evaluatePromotion({
  baseline: {
    qualityByLocale: { en: [0.65, 0.65], es: [0.64, 0.65] },
    categoryScores: { originality: 0.55, coherence: 0.68, localization: 0.68 },
    costUsd: 0.04,
    latencySeconds: 10,
    failures: 0,
  },
  candidate: {
    qualityByLocale: { en: [0.78, 0.78], es: [0.76, 0.76] },
    categoryScores: { originality: 0.6, coherence: 0.76, localization: 0.76 },
    costUsd: 0.03,
    latencySeconds: 10,
    failures: 0,
  },
});
assert.equal(weakCreativeDimension.promote, false);
assert.ok(weakCreativeDimension.reasons.includes("category_originality_floor"));

const plannedTasks = planTasks();
const textTasks = plannedTasks.filter(({ kind }) => kind === "text");
const textLedger = new BenchmarkSpendLedger(3);
for (const task of textTasks) textLedger.reserve(task.id, task.maximumUsd);
assert.equal(textTasks.length, 16);
assert.equal(textLedger.summary().reservedUsd, 0.14522);
assert.ok(textLedger.summary().reservedUsd < 3);
assert.deepEqual(
  Object.fromEntries(
    (["text", "image", "music", "voice"] as const).map((kind) => [
      kind,
      plannedTasks.filter((task) => task.kind === kind).length,
    ]),
  ),
  { text: 16, image: 12, music: 8, voice: 8 },
);
assert.equal(
  plannedTasks.some((task) => task.model.id === "reve/create"),
  false,
);

assert.equal(
  scoreBenchmarkLocalization(
    "La percusión cruza el patio hasta que una luz abre el espacio entre las paredes.",
    "en",
  ),
  0.4,
);
assert.equal(
  scoreBenchmarkLocalization(
    "The percussion crosses the courtyard until a narrow light opens the space between walls.",
    "en",
  ),
  1,
);
const instrumentalScores = scoreTextBenchmarkSample(
    JSON.stringify({
      title: "Clockwork Dust Garden",
      creativeDirection:
        "A dry pulse grows through shifting negative space until a three-note glass signal opens the final section.",
      lyricTheme: null,
      lyrics: null,
      productionPlan: {
        bpm: 112,
        key: "D minor",
        meter: "4/4",
        sections: [
          { name: "intro", startSeconds: 0, endSeconds: 18, direction: "Expose a single dry wooden pulse against near silence." },
          { name: "verse", startSeconds: 18, endSeconds: 52, direction: "Interlock brushed metal and low tom figures without filling the spectrum." },
          { name: "chorus", startSeconds: 52, endSeconds: 94, direction: "Open the harmony around a weightless three-note glass response." },
          { name: "outro", startSeconds: 94, endSeconds: 120, direction: "Remove layers until only the transformed wooden pulse remains." },
        ],
        leadInstruments: ["glass marimba", "bowed vibraphone"],
        rhythmInstruments: ["dry wooden pulse", "low floor tom"],
        textureInstruments: ["observatory room tone", "brushed metal resonance"],
        energyArc: "Controlled mechanical tension gives way to a spacious, weightless release.",
        productionCharacter: ["tactile transients", "deep negative space"],
        vocalDirection: null,
        visual: {
          concept: "Mechanical dust reorganizes itself into a fragile garden.",
          subject: "A clockwork seed opening inside an abandoned observatory",
          medium: "Hand-built wood and glass sculpture photographed on film",
          composition: "Asymmetric square frame with the seed low and open sky above",
          palette: ["charcoal blue", "weathered brass", "clouded glass"],
          lighting: "Narrow dawn side light through suspended dust",
          texture: "Dry wood grain, oxidized metal, restrained film halation",
        },
        novelty: {
          coreMotifs: ["wooden pulse transformation", "three-note glass response"],
          avoidRecentMotifs: ["generic neon tunnel", "piano house hook"],
        },
      },
    }),
    {
      id: "en-instrumental",
      locale: "en",
      request: { exclude: ["Chrome Horizon", "Digital Dreams"] },
      context: {
        djName: "Quiet Vector",
        isInstrumental: true,
        durationSeconds: 120,
      },
    },
  );
assert.equal(instrumentalScores?.schema, 1);
assert.equal(instrumentalScores?.localization, 1);
assert.ok((instrumentalScores?.originality ?? 0) >= 0.75);
assert.ok((instrumentalScores?.quality ?? 0) >= 0.7);

const unequalCoverage = evaluatePromotion({
  baseline: {
    qualityByLocale: { en: [0.62, 0.62, 0.62], es: [0.62, 0.62] },
    categoryScores: { originality: 0.66, coherence: 0.66, localization: 0.66 },
    costUsd: 0.04,
    latencySeconds: 10,
    failures: 0,
  },
  candidate: {
    qualityByLocale: { en: [0.76, 0.76], es: [0.76, 0.76] },
    categoryScores: { originality: 0.76, coherence: 0.76, localization: 0.76 },
    costUsd: 0.03,
    latencySeconds: 10,
    failures: 0,
  },
});
assert.equal(unequalCoverage.promote, false);
assert.ok(unequalCoverage.reasons.includes("locale_en_samples"));

assert.throws(
  () => evaluatePromotion({
    baseline: {
      qualityByLocale: { en: [0.65, 0.65], es: [0.65, 0.65] },
      categoryScores: { originality: 0.7, coherence: 0.7, localization: 0.7 },
      costUsd: 0.04,
      latencySeconds: 10,
      failures: 0,
    },
    candidate: {
      qualityByLocale: { en: [7.6, 0.76], es: [0.76, 0.76] },
      categoryScores: { originality: 0.76, coherence: 0.76, localization: 0.76 },
      costUsd: 0.03,
      latencySeconds: 10,
      failures: 0,
    },
  }),
  /benchmark_scores_invalid/,
);

assert.throws(
  () => evaluatePromotion({
    baseline: {
      qualityByLocale: { en: [0.65, 0.65], es: [0.65, 0.65] },
      categoryScores: { originality: 0.7, coherence: 0.7, localization: 0.7 },
      costUsd: 0.04,
      latencySeconds: 10,
      failures: 0,
    },
    candidate: {
      qualityByLocale: { en: [0.76, 0.76], es: [0.76, 0.76] },
      categoryScores: { originality: 1.5, coherence: 0.76, localization: 0.76 },
      costUsd: 0.03,
      latencySeconds: 10,
      failures: 0,
    },
  }),
  /benchmark_scores_invalid/,
);

const ratedScorecard = buildRatedScorecard({
    categories: ["originality", "coherence", "localization"],
    results: [
      {
        taskId: "task-en",
        caseId: "en-case",
        locale: "en",
        success: true,
        actualUsd: 0.02,
        latencySeconds: 8,
        sampleId: "sample-001",
      },
      {
        taskId: "task-es",
        caseId: "es-case",
        locale: "es",
        success: true,
        actualUsd: 0.02,
        latencySeconds: 12,
        sampleId: "sample-002",
      },
    ],
    ratings: [
      {
        sampleId: "sample-001",
        overall: 0.8,
        categories: { originality: 0.8, coherence: 0.75, localization: 0.9 },
      },
      {
        sampleId: "sample-002",
        overall: 0.72,
        categories: { originality: 0.7, coherence: 0.75, localization: 0.8 },
      },
    ],
});
assert.deepEqual(ratedScorecard, {
  qualityByLocale: { en: [0.8], es: [0.72] },
  categoryScores: { originality: 0.75, coherence: 0.75, localization: 0.85 },
  costUsd: 0.04,
  latencySeconds: 10,
  failures: 0,
});

const ratingTemplate = buildBlindRatingTemplate([
    {
      sampleId: "sample-001",
      kind: "text",
      locale: "es",
      taskId: "text:es-vocal:secret-model",
      modelId: "secret/model",
      variant: "es-vocal",
    },
    {
      sampleId: "sample-002",
      kind: "image",
      locale: "en",
      taskId: "image:rain-signal:secret-model",
      modelId: "secret/model",
      variant: "rain-signal",
    },
]);
assert.deepEqual(ratingTemplate, {
  version: 1,
  scale: { minimum: 0, maximum: 1 },
  samples: [
    {
      sampleId: "sample-001",
      kind: "text",
      locale: "es",
      overall: null,
      categories: {
        originality: null,
        coherence: null,
        localization: null,
      },
    },
    {
      sampleId: "sample-002",
      kind: "image",
      locale: "en",
      overall: null,
      categories: {
        originality: null,
        prompt_alignment: null,
        composition: null,
      },
    },
  ],
});
assert.doesNotMatch(
  JSON.stringify(ratingTemplate),
  /secret|modelId|taskId|variant/,
);

const comparisonCases = [
  { caseId: "en-a", locale: "en" as const },
  { caseId: "en-b", locale: "en" as const },
  { caseId: "es-a", locale: "es" as const },
  { caseId: "es-b", locale: "es" as const },
];
const comparisonRatings: Array<{
  sampleId: string;
  overall: number;
  categories: Record<string, number>;
}> = [];
const baselineComparisonResults = comparisonCases.map((item, index) => {
  const sampleId = `sample-baseline-${index}`;
  comparisonRatings.push({
    sampleId,
    overall: item.locale === "en" ? 0.61 : 0.6,
    categories: { originality: 0.6, coherence: 0.61, localization: 0.62 },
  });
  return {
    taskId: `baseline-${item.caseId}`,
    caseId: item.caseId,
    locale: item.locale,
    success: true,
    actualUsd: 0.01,
    latencySeconds: 10,
    sampleId,
  };
});
const candidateComparisonResults = comparisonCases.map((item, index) => {
  const sampleId = `sample-candidate-${index}`;
  comparisonRatings.push({
    sampleId,
    overall: item.locale === "en" ? 0.76 : 0.75,
    categories: { originality: 0.75, coherence: 0.76, localization: 0.77 },
  });
  return {
    taskId: `candidate-${item.caseId}`,
    caseId: item.caseId,
    locale: item.locale,
    success: true,
    actualUsd: 0.009,
    latencySeconds: 11,
    sampleId,
  };
});
const comparison = analyzeRatedComparison({
    categories: ["originality", "coherence", "localization"],
    baselineResults: baselineComparisonResults,
    candidateResults: candidateComparisonResults,
    ratings: comparisonRatings,
});
assert.deepEqual(comparison.decision, { promote: true, reasons: [] });

assert.throws(
  () => analyzeRatedComparison({
    categories: ["originality", "coherence", "localization"],
    baselineResults: baselineComparisonResults,
    candidateResults: candidateComparisonResults.map((result, index) => (
      index === 0 ? { ...result, caseId: "different-case" } : result
    )),
    ratings: comparisonRatings,
  }),
  /benchmark_comparison_unpaired/,
);

assert.throws(
  () => analyzeRatedComparison({
    categories: ["originality", "coherence", "localization"],
    baselineResults: baselineComparisonResults.map((result, index) => (
      index === 1 ? { ...result, caseId: "en-a" } : result
    )),
    candidateResults: candidateComparisonResults.map((result, index) => (
      index === 1 ? { ...result, caseId: "en-a" } : result
    )),
    ratings: comparisonRatings,
  }),
  /benchmark_comparison_unpaired/,
);

console.log("creative benchmark checks passed");
