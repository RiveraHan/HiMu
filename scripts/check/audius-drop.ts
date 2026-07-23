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
import { buildAudiusPickInput } from "../../supabase/functions/generate-mix/audius-drop";

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

console.log("✓ audius-drop helpers OK");
