import assert from "node:assert/strict";

async function main() {
  const module = await import(
    "../../supabase/functions/generate-mix/generation-seasoning.ts"
  ).catch(() => null);
  assert.ok(module, "generation seasoning module must be executable outside Deno");

  const {
    atmosphereGenerationClause,
    buildGenerationSeasoning,
  } = module;

  assert.equal(
    atmosphereGenerationClause("calm"),
    "listener preference: restrained dynamics, softer transients, and a gentle energy arc",
  );
  assert.equal(
    atmosphereGenerationClause("balanced"),
    "listener preference: balanced dynamics, controlled contrast, and a moderate energy arc",
  );
  assert.equal(
    atmosphereGenerationClause("intense"),
    "listener preference: driving dynamics, pronounced contrast, and a high-energy arc",
  );

  const normal = await buildGenerationSeasoning(
    { userId: "user-1", djGenres: ["House", "Jazz"], localHour: 20 },
    {
      loadPreferences: async () => ({
        genres: ["House"],
        atmosphere: "intense",
      }),
      loadTopGenres: async () => ["Jazz", "Jazz", "House"],
      now: () => new Date("2026-08-29T12:00:00.000Z"),
    },
  );
  assert.deepEqual(normal, [
    "emphasis on jazz",
    "listener preference: driving dynamics, pronounced contrast, and a high-energy arc",
    "evening warmth",
  ]);

  const compatibleFavorite = await buildGenerationSeasoning(
    { userId: "user-1", djGenres: ["House"], localHour: 8 },
    {
      loadPreferences: async () => ({ genres: ["House"], atmosphere: "calm" }),
      loadTopGenres: async () => ["Jazz", "Jazz"],
      now: () => new Date("2026-08-29T12:00:00.000Z"),
    },
  );
  assert.deepEqual(compatibleFavorite, [
    "emphasis on house",
    "listener preference: restrained dynamics, softer transients, and a gentle energy arc",
    "fresh morning feel",
  ]);

  for (const atmosphere of [null, "unexpected", undefined]) {
    const seasoning = await buildGenerationSeasoning(
      { userId: "user-1", djGenres: [], localHour: 12 },
      {
        loadPreferences: async () => ({ genres: null, atmosphere } as any),
        loadTopGenres: async () => [],
        now: () => new Date("2026-08-29T12:00:00.000Z"),
      },
    );
    assert.deepEqual(seasoning, [
      "listener preference: balanced dynamics, controlled contrast, and a moderate energy arc",
      "steady daytime flow",
    ]);
  }

  const lookupFailure = await buildGenerationSeasoning(
    { userId: "user-1", djGenres: ["House"], localHour: 2 },
    {
      loadPreferences: async () => {
        throw new Error("database unavailable");
      },
      loadTopGenres: async () => [],
      now: () => new Date("2026-08-29T12:00:00.000Z"),
    },
  );
  assert.deepEqual(lookupFailure, [
    "listener preference: balanced dynamics, controlled contrast, and a moderate energy arc",
    "late night atmosphere",
  ]);

  console.log("generation seasoning checks passed");
}

main();
