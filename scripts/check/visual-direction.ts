import assert from "node:assert/strict";
import {
  compileVisualDirection,
  renderVisualPrompt,
} from "../../supabase/functions/_shared/visual-direction.ts";

const fallback = compileVisualDirection({
  purpose: "cover",
  seed: "job-42:cover-v2",
  genres: ["dream pop"],
  moods: ["intimate", "hopeful"],
  instrumental: false,
  identityConcept: null,
  visualPlan: null,
});
assert.deepEqual(
  fallback,
  compileVisualDirection({
    purpose: "cover",
    seed: "job-42:cover-v2",
    genres: ["dream pop"],
    moods: ["intimate", "hopeful"],
    instrumental: false,
    identityConcept: null,
    visualPlan: null,
  }),
);
assert.equal(fallback.palette.length, 3);
assert.ok(fallback.seed >= 0 && fallback.seed <= 2_147_483_647);

const planned = compileVisualDirection({
  purpose: "cover",
  seed: "job-43:cover-v2",
  genres: ["electronic"],
  moods: ["luminous"],
  instrumental: true,
  identityConcept: null,
  visualPlan: {
    concept: "A fragile signal becomes a shared constellation in rain.",
    subject: "Translucent antenna forms above a wet rooftop",
    medium: "Layered paper sculpture photographed on film",
    composition: "Asymmetric square frame rising from the lower third",
    palette: ["smoked indigo", "warm amber", "frosted cyan"],
    lighting: "Low amber side light with cyan reflections",
    texture: "Visible paper fibers, fine rain grain, restrained halation",
  },
});
const coverPrompt = renderVisualPrompt(planned);
for (const required of [
  "fragile signal", "Translucent antenna", "paper sculpture", "smoked indigo",
  "Asymmetric square", "Visible paper fibers",
]) {
  assert.match(coverPrompt, new RegExp(required, "i"));
}
assert.match(coverPrompt, /no text, no typography, no letters, no logo, no watermark/i);
assert.match(coverPrompt, /album artwork/i);
assert.ok(coverPrompt.length <= 4_000);

const avatar = compileVisualDirection({
  purpose: "avatar",
  seed: "dj-sol:avatar-v2",
  genres: ["Latin electronic"],
  moods: ["warm", "kinetic"],
  instrumental: false,
  identityConcept: "A sunrise selector shaping hopeful nocturnal pop.",
  visualPlan: null,
});
const avatarPrompt = renderVisualPrompt(avatar);
assert.match(avatarPrompt, /fictional adult DJ persona/i);
assert.match(avatarPrompt, /sunrise selector/i);
assert.match(avatarPrompt, /not a real person|no celebrity likeness/i);
assert.doesNotMatch(avatarPrompt, /no faces/i);

const variants = new Set(
  Array.from({ length: 48 }, (_, index) =>
    renderVisualPrompt(compileVisualDirection({
      purpose: "cover",
      seed: `cover-${index}`,
      genres: ["electronic"],
      moods: ["focused"],
      instrumental: true,
      identityConcept: null,
      visualPlan: null,
    }))),
);
assert.ok(variants.size >= 44, `expected deterministic visual variety, got ${variants.size}`);

console.log("visual direction checks passed");
