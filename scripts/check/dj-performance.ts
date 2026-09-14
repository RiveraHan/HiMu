import assert from "node:assert/strict";
import {
  compileDjPerformance,
  renderCaptionSystemPrompt,
  renderTtsText,
} from "../../supabase/functions/_shared/dj-performance.ts";

const energetic = compileDjPerformance({
  language: "es",
  voiceStyle: "femenina, brillante y cercana",
  moods: ["energetic", "uplifting"],
  character: "Cálida, curiosa, muy atenta a los pequeños detalles de producción.",
});
assert.equal(energetic.voiceId, "Ashley");
assert.ok(energetic.speakingRate > 1 && energetic.speakingRate <= 1.1);
assert.match(energetic.deliveryCue, /energía|sonrisa/i);
assert.deepEqual(
  energetic,
  compileDjPerformance({
    language: "es",
    voiceStyle: "femenina, brillante y cercana",
    moods: ["energetic", "uplifting"],
    character: "Cálida, curiosa, muy atenta a los pequeños detalles de producción.",
  }),
);

const calm = compileDjPerformance({
  language: "en",
  voiceStyle: "androgynous and ethereal",
  moods: ["calm", "late night"],
  character: "Measured and observant",
});
assert.equal(calm.voiceId, "Alex");
assert.ok(calm.speakingRate < 1);
assert.match(calm.deliveryCue, /measured|close/i);

const system = renderCaptionSystemPrompt({
  djName: "Sol",
  character: "Warm and curious",
  profile: calm,
  kind: "generated_track",
});
assert.match(system, /8 to 20 words/i);
assert.match(system, /one concrete listening detail/i);
assert.match(system, /no emojis, hashtags, quotation marks/i);
assert.match(system, /avoid.*turn it up/i);
assert.match(system, /\[CAPTION_START\]/);

const spoken = renderTtsText(
  energetic,
  "Hoy el bajo respira entre palmas secas y un coro que abre el horizonte.",
);
assert.ok(spoken.length <= 200);
assert.match(spoken, /^\[/);
assert.doesNotMatch(spoken, /\[(?:scream|laugh|whisper)\]/i);
assert.throws(
  () => renderTtsText(energetic, "x".repeat(141)),
  /caption/i,
);

console.log("DJ performance checks passed");
