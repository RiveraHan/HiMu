import assert from "node:assert/strict";
import { deterministicCreativeTitle } from "../../supabase/functions/_shared/creative-titles.ts";

const english = deterministicCreativeTitle({
  language: "en",
  seed: "job-42:title-v1",
  genres: ["dream pop"],
  moods: ["hopeful", "late night"],
  recentTitles: [],
});
assert.equal(
  english,
  deterministicCreativeTitle({
    language: "en",
    seed: "job-42:title-v1",
    genres: ["dream pop"],
    moods: ["hopeful", "late night"],
    recentTitles: [],
  }),
  "the same job context must produce the same title",
);
assert.match(english, /^[\p{L}\p{N}'’ -]{4,60}$/u);

const spanish = deterministicCreativeTitle({
  language: "es",
  seed: "trabajo-9:title-v1",
  genres: ["electrónica latina"],
  moods: ["íntimo", "luminoso"],
  recentTitles: [],
});
assert.match(spanish, /^[\p{L}\p{N}'’ -]{4,60}$/u);
assert.doesNotMatch(spanish, /^(Neón Pulsante|Medianoche Dorada)$/);

const excluded = deterministicCreativeTitle({
  language: "en",
  seed: "job-42:title-v1",
  genres: ["dream pop"],
  moods: ["hopeful"],
  recentTitles: [english.toUpperCase()],
});
assert.notEqual(excluded.toLocaleLowerCase(), english.toLocaleLowerCase());

const generated = new Set(
  Array.from({ length: 512 }, (_, index) =>
    deterministicCreativeTitle({
      language: index % 2 === 0 ? "en" : "es",
      seed: `job-${index}:title-v1`,
      genres: index % 3 === 0 ? ["ambient"] : ["electronic pop"],
      moods: index % 5 === 0 ? ["tender"] : ["kinetic"],
      recentTitles: [],
    }).toLocaleLowerCase()),
);
assert.ok(generated.size >= 440, `expected broad title variety, got ${generated.size}`);

for (const title of generated) {
  assert.ok(title.length <= 60);
  assert.doesNotMatch(title, /neon pulse|neón pulsante|midnight glow|eco de terciopelo/);
}

console.log("creative title checks passed");
