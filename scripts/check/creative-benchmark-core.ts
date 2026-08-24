export type BenchmarkLocale = "en" | "es";

export type BenchmarkScorecard = {
  qualityByLocale: Record<BenchmarkLocale, number[]>;
  categoryScores: Record<string, number>;
  costUsd: number;
  latencySeconds: number;
  failures: number;
};

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
