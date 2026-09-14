export type BenchmarkLocale = "en" | "es";
export type BenchmarkKind = "text" | "image" | "music" | "voice";

export const BENCHMARK_RATING_CATEGORIES: Readonly<
  Record<BenchmarkKind, readonly string[]>
> = Object.freeze({
  text: Object.freeze(["originality", "coherence", "localization"]),
  image: Object.freeze(["originality", "prompt_alignment", "composition"]),
  music: Object.freeze(["originality", "coherence", "prompt_alignment"]),
  voice: Object.freeze(["naturalness", "persona_fit", "localization"]),
});

export type BenchmarkScorecard = {
  qualityByLocale: Record<BenchmarkLocale, number[]>;
  categoryScores: Record<string, number>;
  costUsd: number;
  latencySeconds: number;
  failures: number;
};

export type RatedBenchmarkResult = {
  taskId: string;
  caseId: string;
  locale: BenchmarkLocale;
  success: boolean;
  actualUsd: number;
  latencySeconds: number | null;
  sampleId: string | null;
};

export type BlindBenchmarkRating = {
  sampleId: string;
  overall: number;
  categories: Record<string, number>;
};

export function buildBlindRatingTemplate(
  samples: Array<{
    sampleId: string;
    kind: BenchmarkKind;
    locale: BenchmarkLocale;
  }>,
): {
  version: 1;
  scale: { minimum: 0; maximum: 1 };
  samples: Array<{
    sampleId: string;
    kind: BenchmarkKind;
    locale: BenchmarkLocale;
    overall: null;
    categories: Record<string, null>;
  }>;
} {
  const seen = new Set<string>();
  return {
    version: 1,
    scale: { minimum: 0, maximum: 1 },
    samples: samples.map((sample) => {
      if (
        !/^sample-[0-9]{3,}$/.test(sample.sampleId) ||
        seen.has(sample.sampleId) ||
        !BENCHMARK_RATING_CATEGORIES[sample.kind] ||
        (sample.locale !== "en" && sample.locale !== "es")
      ) {
        throw new Error("benchmark_rating_template_invalid");
      }
      seen.add(sample.sampleId);
      return {
        sampleId: sample.sampleId,
        kind: sample.kind,
        locale: sample.locale,
        overall: null,
        categories: Object.fromEntries(
          BENCHMARK_RATING_CATEGORIES[sample.kind].map((category) => [category, null]),
        ),
      };
    }),
  };
}

function money(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export class BenchmarkSpendLedger {
  readonly #limitUsd: number;
  readonly #reservations = new Map<string, { reserved: number; actual: number | null }>();
  #reservedUsd = 0;
  #actualUsd = 0;

  constructor(limitUsd: number) {
    if (!Number.isFinite(limitUsd) || limitUsd <= 0) throw new Error("benchmark_budget_invalid");
    this.#limitUsd = money(limitUsd);
  }

  reserve(id: string, maximumUsd: number): void {
    if (!id || this.#reservations.has(id)) throw new Error("benchmark_duplicate_reservation");
    if (!Number.isFinite(maximumUsd) || maximumUsd < 0) {
      throw new Error("benchmark_reservation_invalid");
    }
    const amount = money(maximumUsd);
    if (money(this.#reservedUsd + amount) > this.#limitUsd) {
      throw new Error("benchmark_budget_exceeded");
    }
    this.#reservations.set(id, { reserved: amount, actual: null });
    this.#reservedUsd = money(this.#reservedUsd + amount);
  }

  complete(id: string, actualUsd: number): void {
    const reservation = this.#reservations.get(id);
    if (!reservation) throw new Error("benchmark_reservation_missing");
    if (reservation.actual != null) throw new Error("benchmark_reservation_completed");
    if (!Number.isFinite(actualUsd) || actualUsd < 0) throw new Error("benchmark_actual_invalid");
    const actual = money(actualUsd);
    if (actual > reservation.reserved) throw new Error("benchmark_actual_exceeds_reserved");
    reservation.actual = actual;
    this.#actualUsd = money(this.#actualUsd + actual);
  }

  summary(): {
    limitUsd: number;
    reservedUsd: number;
    actualUsd: number;
    remainingUsd: number;
    completed: number;
  } {
    return {
      limitUsd: this.#limitUsd,
      reservedUsd: this.#reservedUsd,
      actualUsd: this.#actualUsd,
      remainingUsd: money(this.#limitUsd - this.#reservedUsd),
      completed: [...this.#reservations.values()].filter(({ actual }) => actual != null).length,
    };
  }
}

function mean(values: number[]): number {
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  ) {
    throw new Error("benchmark_scores_invalid");
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildRatedScorecard(input: {
  categories: string[];
  results: RatedBenchmarkResult[];
  ratings: BlindBenchmarkRating[];
}): BenchmarkScorecard {
  const categories = [...input.categories];
  if (
    categories.length === 0 ||
    new Set(categories).size !== categories.length ||
    categories.some((category) => !/^[a-z][a-z0-9_]{1,31}$/.test(category)) ||
    input.results.length === 0
  ) {
    throw new Error("benchmark_ratings_invalid");
  }
  const ratings = new Map<string, BlindBenchmarkRating>();
  for (const rating of input.ratings) {
    if (!rating.sampleId || ratings.has(rating.sampleId)) {
      throw new Error("benchmark_ratings_invalid");
    }
    ratings.set(rating.sampleId, rating);
  }

  const qualityByLocale: Record<BenchmarkLocale, number[]> = { en: [], es: [] };
  const categoryTotals = Object.fromEntries(
    categories.map((category) => [category, 0]),
  ) as Record<string, number>;
  const latencies: number[] = [];
  let costUsd = 0;
  let failures = 0;

  for (const result of input.results) {
    if (
      !result.taskId ||
      (result.locale !== "en" && result.locale !== "es") ||
      !Number.isFinite(result.actualUsd) || result.actualUsd < 0
    ) {
      throw new Error("benchmark_ratings_invalid");
    }
    costUsd += result.actualUsd;
    if (!result.success) {
      failures += 1;
      qualityByLocale[result.locale].push(0);
      continue;
    }
    if (
      !Number.isFinite(result.latencySeconds) || Number(result.latencySeconds) < 0 ||
      !result.sampleId
    ) {
      throw new Error("benchmark_ratings_invalid");
    }
    const rating = ratings.get(result.sampleId);
    const ratingCategories = rating ? Object.keys(rating.categories).sort() : [];
    const expectedCategories = [...categories].sort();
    if (
      !rating ||
      ratingCategories.length !== expectedCategories.length ||
      ratingCategories.some((category, index) => category !== expectedCategories[index])
    ) {
      throw new Error("benchmark_rating_missing");
    }
    mean([rating.overall]);
    qualityByLocale[result.locale].push(rating.overall);
    for (const category of categories) {
      const score = rating.categories[category];
      mean([score]);
      categoryTotals[category] += score;
    }
    latencies.push(result.latencySeconds);
  }

  return {
    qualityByLocale,
    categoryScores: Object.fromEntries(
      categories.map((category) => [
        category,
        money(categoryTotals[category] / input.results.length),
      ]),
    ),
    costUsd: money(costUsd),
    latencySeconds: latencies.length > 0
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : 1_000_000_000,
    failures,
  };
}

export function analyzeRatedComparison(input: {
  categories: string[];
  baselineResults: RatedBenchmarkResult[];
  candidateResults: RatedBenchmarkResult[];
  ratings: BlindBenchmarkRating[];
}): {
  baseline: BenchmarkScorecard;
  candidate: BenchmarkScorecard;
  decision: { promote: boolean; reasons: string[] };
} {
  const baselineCases = input.baselineResults
    .map((result) => `${result.locale}:${result.caseId}`)
    .sort();
  const candidateCases = input.candidateResults
    .map((result) => `${result.locale}:${result.caseId}`)
    .sort();
  if (
    baselineCases.length !== candidateCases.length ||
    new Set(baselineCases).size !== baselineCases.length ||
    new Set(candidateCases).size !== candidateCases.length ||
    baselineCases.some((caseId, index) => caseId !== candidateCases[index])
  ) {
    throw new Error("benchmark_comparison_unpaired");
  }
  const baseline = buildRatedScorecard({
    categories: input.categories,
    results: input.baselineResults,
    ratings: input.ratings,
  });
  const candidate = buildRatedScorecard({
    categories: input.categories,
    results: input.candidateResults,
    ratings: input.ratings,
  });
  return {
    baseline,
    candidate,
    decision: evaluatePromotion({ baseline, candidate }),
  };
}

export function evaluatePromotion(input: {
  baseline: BenchmarkScorecard;
  candidate: BenchmarkScorecard;
}): { promote: boolean; reasons: string[] } {
  for (const scorecard of [input.baseline, input.candidate]) {
    if (
      Object.values(scorecard.categoryScores).some((score) =>
        !Number.isFinite(score) || score < 0 || score > 1
      )
    ) {
      throw new Error("benchmark_scores_invalid");
    }
  }
  const reasons: string[] = [];
  for (const locale of ["en", "es"] as const) {
    const baselineScores = input.baseline.qualityByLocale[locale];
    const candidateScores = input.candidate.qualityByLocale[locale];
    if (
      baselineScores.length < 2 || candidateScores.length < 2 ||
      baselineScores.length !== candidateScores.length
    ) {
      reasons.push(`locale_${locale}_samples`);
    }
    const baseline = mean(baselineScores);
    const candidate = mean(candidateScores);
    if (candidate < 0.7) reasons.push(`locale_${locale}_floor`);
    if (candidateScores.some((score) => score < 0.6)) {
      reasons.push(`locale_${locale}_consistency`);
    }
    if (baseline <= 0 || (candidate - baseline) / baseline < 0.15) {
      reasons.push(`locale_${locale}_quality`);
    }
  }
  for (const [category, baseline] of Object.entries(input.baseline.categoryScores)) {
    const candidate = input.candidate.categoryScores[category];
    if (Number.isFinite(candidate) && candidate < 0.65) {
      reasons.push(`category_${category}_floor`);
    }
    if (!Number.isFinite(candidate) || candidate < baseline - 0.05) {
      reasons.push(`category_${category}_regression`);
    }
  }
  if (input.candidate.costUsd > input.baseline.costUsd) reasons.push("cost");
  if (input.candidate.latencySeconds > input.baseline.latencySeconds * 1.25) {
    reasons.push("latency");
  }
  if (input.candidate.failures > input.baseline.failures) reasons.push("failures");
  return { promote: reasons.length === 0, reasons };
}
