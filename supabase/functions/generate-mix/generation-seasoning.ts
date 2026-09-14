export const ATMOSPHERE_GENERATION_CLAUSES = {
  calm:
    "listener preference: restrained dynamics, softer transients, and a gentle energy arc",
  balanced:
    "listener preference: balanced dynamics, controlled contrast, and a moderate energy arc",
  intense:
    "listener preference: driving dynamics, pronounced contrast, and a high-energy arc",
} as const;

type Atmosphere = keyof typeof ATMOSPHERE_GENERATION_CLAUSES;

export type GenerationSeasoningDependencies = Readonly<{
  loadPreferences(
    userId: string,
  ): Promise<{ genres: string[] | null; atmosphere: string | null } | null>;
  loadTopGenres(userId: string, since: string): Promise<(string | null)[]>;
  now(): Date;
}>;

export function atmosphereGenerationClause(value: unknown): string {
  const atmosphere: Atmosphere = value === "calm" || value === "intense"
    ? value
    : "balanced";
  return ATMOSPHERE_GENERATION_CLAUSES[atmosphere];
}

function timeGenerationClause(localHour: unknown, now: Date): string {
  const hour = typeof localHour === "number" &&
      Number.isInteger(localHour) &&
      localHour >= 0 &&
      localHour <= 23
    ? localHour
    : now.getUTCHours();
  return hour >= 5 && hour <= 11
    ? "fresh morning feel"
    : hour >= 12 && hour <= 17
    ? "steady daytime flow"
    : hour >= 18 && hour <= 22
    ? "evening warmth"
    : "late night atmosphere";
}

function recentTopGenre(values: readonly (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const genre of values) {
    if (typeof genre !== "string") continue;
    counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]
    ?.[0] ?? null;
}

export async function buildGenerationSeasoning(
  input: { userId: string; djGenres: readonly string[]; localHour: unknown },
  deps: GenerationSeasoningDependencies,
): Promise<string[]> {
  const clauses: string[] = [];
  let atmosphere: unknown = null;

  try {
    const since = new Date(
      deps.now().getTime() - 14 * 24 * 60 * 60 * 1_000,
    ).toISOString().slice(0, 10);
    const [preferences, topGenres] = await Promise.all([
      deps.loadPreferences(input.userId),
      deps.loadTopGenres(input.userId, since),
    ]);
    atmosphere = preferences?.atmosphere;
    const candidates = [
      recentTopGenre(topGenres),
      ...(preferences?.genres ?? []),
    ];
    const emphasis = candidates.find((genre) =>
      typeof genre === "string" && input.djGenres.includes(genre)
    );
    if (emphasis) clauses.push(`emphasis on ${emphasis.toLowerCase()}`);
  } catch (_error) {
    console.error("[generate-mix] generation", { stage: "seasoning_lookup" });
  }

  clauses.push(atmosphereGenerationClause(atmosphere));
  clauses.push(timeGenerationClause(input.localHour, deps.now()));
  return clauses;
}
