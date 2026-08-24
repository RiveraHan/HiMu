import assert from "node:assert/strict";
import {
  parseGeneratedPublicKey,
  parsePrivateMediaReference,
  privateMediaReference,
} from "../../supabase/functions/_shared/media-reference";

const trackKey = "tracks/generated/job-1/2026-08-23T12%3A00%3A00.000Z.mp3";
const captionKey = "captions/generated/job-1/2026-08-23T12%3A00%3A00.000Z.mp3";

assert.equal(privateMediaReference(trackKey), `r2-private://${trackKey}`);
assert.deepEqual(parsePrivateMediaReference(`r2-private://${trackKey}`, "track"), {
  key: trackKey,
  kind: "track",
});
assert.deepEqual(
  parsePrivateMediaReference(`r2-private://${captionKey}`, "caption"),
  { key: captionKey, kind: "caption" },
);
assert.deepEqual(
  parseGeneratedPublicKey(`https://media.example/${trackKey}`, "https://media.example"),
  { key: trackKey, kind: "track" },
);

for (const invalid of [
  "https://public.example/private.mp3",
  "r2-private://avatars/generated/a.jpg",
  "r2-private://tracks/generated/../secret.mp3",
  "r2-private://tracks/generated/%2e%2e/secret.mp3",
  "r2-private://tracks/generated/job\\secret/file.mp3",
  `r2-private://${trackKey}?download=1`,
  `r2-private://${trackKey}#fragment`,
  `r2-private://${trackKey}\u0000`,
]) {
  assert.equal(parsePrivateMediaReference(invalid, "track"), null, invalid);
}
assert.equal(parsePrivateMediaReference(`r2-private://${captionKey}`, "track"), null);
assert.equal(parsePrivateMediaReference(`r2-private://${trackKey}`, "caption"), null);
assert.equal(parseGeneratedPublicKey("https://other.example/tracks/generated/a/b.mp3", "https://media.example"), null);

console.log("media reference checks passed");
