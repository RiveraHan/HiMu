import assert from "node:assert/strict";
/**
 * Standalone check for the pure Audius drop-selection helpers.
 * (No test framework in this repo, and deno isn't on PATH — these helpers are
 * Deno-free so tsx can import them.)
 *   npx tsx scripts/check/audius-drop.ts
 */
import {
  mapDjGenre,
  parsePickResponse,
} from "../../supabase/functions/_shared/audius";
import {
  fallbackAudiusCaption,
  LLAMA_ENDPOINT,
} from "../../supabase/functions/generate-mix/generation-models";
import {
  buildAudiusPickInput,
  fallbackAudiusPickCaption,
} from "../../supabase/functions/generate-mix/audius-drop";
import * as audiusDropModule from "../../supabase/functions/generate-mix/audius-drop";
import type { CreativeUsageEvent } from "../../supabase/functions/_shared/creative-telemetry";
import type { NormalizedPrediction } from "../../supabase/functions/_shared/replicate";

function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
}

const dj = {
  name: "Sol",
  character: "warm and curious",
  voice_style: "feminine",
  genre_specialties: ["Latin Pop"],
};
const candidates = [{
  id: "track-1",
  title: "Luz Azul",
  user: { name: "Mara" },
}];
const spanish = buildAudiusPickInput(dj, 21, candidates, "es");
assert.equal(spanish.endpoint, LLAMA_ENDPOINT);
assert.match(spanish.body.input.system_prompt, /español latinoamericano neutro/i);
assert.match(spanish.body.input.prompt, /PICK: <number>\nCAPTION:/);
assert.match(spanish.body.input.prompt, /esta noche/i);
assert.equal(
  fallbackAudiusCaption("es", "Luz Azul", "Mara"),
  "Un hallazgo nuevo — Luz Azul de Mara.",
);
assert.equal(
  fallbackAudiusPickCaption(undefined, "Luz Azul", "Mara"),
  "Fresh find — Luz Azul by Mara.",
  "legacy two-argument pick defaults its fallback caption to English",
);

const missingArtistCandidates = [{
  id: "track-missing-artist",
  title: "Luz [scream]",
  user: undefined,
}];
const spanishMissingArtist = buildAudiusPickInput(
  dj,
  21,
  missingArtistCandidates,
  "es",
);
assert.doesNotMatch(spanishMissingArtist.body.input.prompt, /\bUnknown\b/);
assert.match(spanishMissingArtist.body.input.prompt, /artista desconocido/i);
assert.equal(
  fallbackAudiusCaption("es", "Luz [scream]", null),
  "Un hallazgo nuevo — Luz [scream] de artista desconocido.",
);
const englishMissingArtist = buildAudiusPickInput(
  dj,
  21,
  missingArtistCandidates,
  "en",
);
assert.match(englishMissingArtist.body.input.prompt, /unknown artist/i);

// mapDjGenre: walks specialties, maps the first known, else null.
check(mapDjGenre(["Ambient", "Lo-Fi"]) === "Ambient", "maps first known specialty");
check(mapDjGenre(["Reggaeton", "Latin Pop"]) === "Latin", "reggaeton -> Latin");
check(mapDjGenre(["Deep House"]) === "House", "deep house -> House");
check(mapDjGenre(["Soul", "Funk"]) === "R&B/Soul", "soul -> R&B/Soul");
check(mapDjGenre(["Unknownium", "Techno"]) === "Techno", "skips unknown to next");
check(mapDjGenre(["Polka"]) === null, "no mapping -> null");
check(mapDjGenre([]) === null, "empty -> null");
check(mapDjGenre(null) === null, "null -> null");

// parsePickResponse: 0-based index + caption; robust to garbage.
const ok = parsePickResponse("PICK: 3\nCAPTION: Dug this gem up by Luci for you.", 12);
check(ok.index === 2, "PICK 3 -> index 2");
check(ok.caption === "Dug this gem up by Luci for you.", "caption extracted");
check(parsePickResponse("PICK: 99\nCAPTION: hi", 5).index === 0, "out-of-range PICK -> 0");
check(parsePickResponse("PICK: 0\nCAPTION: hi", 5).index === 0, "PICK 0 -> 0");
check(parsePickResponse('PICK: 1\nCAPTION: "quoted"', 3).caption === "quoted", "strips quotes");
const none = parsePickResponse("i just love this one", 4);
check(none.index === 0, "no PICK -> index 0");
check(none.caption === null, "no CAPTION -> null");
check(parsePickResponse("PICK: 2\nCAPTION: " + "x".repeat(200), 3).caption!.length === 140, "caption capped at 140");

async function checkObservedAudiusPick() {
  const events: CreativeUsageEvent[] = [];
  const timestamps = [3_000, 3_220];
  const pickObserved = (audiusDropModule as unknown as {
    pickAudiusDropWithDependencies?: (
      dj: unknown,
      localHour: unknown,
      language: "en" | "es",
      dependencies: Record<string, unknown>,
    ) => Promise<{ pick: { id: string }; caption: string } | null>;
  }).pickAudiusDropWithDependencies;
  const picked = pickObserved
    ? await pickObserved(dj, 21, "es", {
      fetchCandidates: async () => [
        { id: "track-1", title: "Luz Azul", user: { name: "Mara" } },
        { id: "track-2", title: "Mar de Vidrio", user: { name: "Nilo" } },
      ],
      predict: async () => ({
        output: "PICK: 2\nCAPTION: El pulso de Nilo convierte cada síncopa en un horizonte nuevo.",
        predictionId: "audius-pick-1",
        modelId: "meta/llama-4-scout-instruct",
        startedAt: null,
        completedAt: null,
        metrics: {
          inputTokens: 300,
          outputTokens: 40,
          inputCharacters: null,
          outputSeconds: null,
          predictSeconds: 0.2,
        },
      } satisfies NormalizedPrediction<string>),
      recordUsage: (event: CreativeUsageEvent) => events.push(event),
      now: () => timestamps.shift() ?? 3_220,
    })
    : null;

  assert.equal(picked?.pick.id, "track-2");
  assert.equal(
    picked?.caption,
    "El pulso de Nilo convierte cada síncopa en un horizonte nuevo.",
  );
  assert.deepEqual(events, [{
    role: "creative_shortform",
    modelId: "meta/llama-4-scout-instruct",
    status: "succeeded",
    promptVersion: "audius-pick-v2.es",
    briefVersion: 0,
    language: "es",
    outcome: "generated",
    repaired: false,
    latencyMs: 220,
    estimatedCostUsd: 0.000077,
    inputUnits: 300,
    outputUnits: 40,
  }]);
  assert.doesNotMatch(
    JSON.stringify(events),
    /Luz Azul|Mar de Vidrio|Mara|Nilo|horizonte nuevo/,
  );
}

checkObservedAudiusPick()
  .then(() => console.log("✓ audius-drop helpers OK"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
