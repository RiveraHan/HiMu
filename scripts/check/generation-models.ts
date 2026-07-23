import assert from "node:assert/strict";
import {
  buildCaptionInput,
  buildCaptionTtsInput,
  buildMusicInput,
  captionTimePhrase,
  creativeTitle,
  fallbackAudiusCaption,
  INWORLD_TTS_ENDPOINT,
  LLAMA_ENDPOINT,
  LYRIA_ENDPOINT,
  MAX_LYRIA_PROMPT_CHARS,
  parseGenerationLanguage,
  validateLyrics,
} from "../../supabase/functions/generate-mix/generation-models";

assert.equal(parseGenerationLanguage(undefined), "en");
assert.equal(parseGenerationLanguage("es"), "es");
assert.throws(() => parseGenerationLanguage("fr"), /language must be en or es/);

const lyrics = "[Verso 1]\n  Sigo aquí...\n\n[Coro]\n¡Sin cambiar!";
assert.equal(validateLyrics(lyrics), lyrics);
assert.equal(validateLyrics("  \n\t"), null);
assert.throws(() => validateLyrics("x".repeat(1001)), /1000/);
assert.throws(() => validateLyrics("hola\u0000mundo"), /control/);

const vocal = buildMusicInput({
  basePrompt: "dream pop",
  seasoning: ["late night atmosphere"],
  instrumental: false,
  durationSeconds: 120,
  language: "es",
  lyrics,
});
assert.equal(vocal.endpoint, LYRIA_ENDPOINT);
assert.deepEqual(Object.keys(vocal.body.input).sort(), ["prompt"]);
assert.match(vocal.body.input.prompt, /español latinoamericano neutro/i);
assert.ok(vocal.body.input.prompt.includes(lyrics));
assert.match(vocal.body.input.prompt, /\[LYRICS_START\]/);
assert.match(vocal.body.input.prompt, /\[LYRICS_END\]/);

const instrumental = buildMusicInput({
  basePrompt: "ambient piano",
  seasoning: [],
  instrumental: true,
  durationSeconds: 90,
  language: "en",
  lyrics: null,
});
assert.match(instrumental.body.input.prompt, /instrumental only/i);
assert.match(instrumental.body.input.prompt, /no vocals/i);
assert.match(instrumental.body.input.prompt, /90-second/i);

const bounded = buildMusicInput({
  basePrompt: "a".repeat(MAX_LYRIA_PROMPT_CHARS),
  seasoning: ["b".repeat(MAX_LYRIA_PROMPT_CHARS)],
  instrumental: false,
  durationSeconds: 120,
  language: "en",
  lyrics,
});
assert.ok(bounded.body.input.prompt.length <= MAX_LYRIA_PROMPT_CHARS);
assert.ok(bounded.body.input.prompt.includes(lyrics));

assert.match(creativeTitle("es", () => 0), /\S+ \S+/);
assert.equal(captionTimePhrase(9, "es"), "esta mañana");
assert.equal(
  fallbackAudiusCaption("es", "Luz de Luna", null),
  "Un hallazgo nuevo — Luz de Luna de un artista que me encanta.",
);

const caption = buildCaptionInput({
  dj: { name: "Sol", character: "warm", voice_style: "feminine", genre_specialties: ["Latin Pop"] },
  localHour: 9,
  trackTitle: "Luz de Luna",
  language: "es",
});
assert.equal(caption.endpoint, LLAMA_ENDPOINT);
assert.match(caption.body.input.system_prompt, /\[CAPTION_START\]/);
assert.match(caption.body.input.system_prompt, /\[CAPTION_END\]/);
assert.match(caption.body.input.prompt, /esta mañana/i);

const spanishTitleRandomValues = [0, 0.17, 0.34, 0.51, 0.68, 0.85];
const spanishTitles = spanishTitleRandomValues.map((value) =>
  creativeTitle("es", () => value)
);
const reviewFailures: string[] = [];
if (!/neutral Latin American Spanish/i.test(caption.body.input.system_prompt)) {
  reviewFailures.push("Spanish captions must require neutral Latin American Spanish");
}
if (JSON.stringify(spanishTitles) !== JSON.stringify([
  "Neón Pulsante",
  "Medianoche Dorada",
  "Bruma Eléctrica",
  "Deriva Lunar",
  "Eco de Terciopelo",
  "Horizonte Luminoso",
])) {
  reviewFailures.push("Spanish titles must use fixed grammatically compatible pairs");
}
assert.deepEqual(reviewFailures, []);

const tts = buildCaptionTtsInput("es", "feminine", ["energetic"], "Hoy subimos el ritmo");
assert.equal(tts.endpoint, INWORLD_TTS_ENDPOINT);
assert.equal(tts.body.input.language, "es");
assert.equal(tts.body.input.audio_format, "mp3");
assert.equal(tts.body.input.sample_rate, 48000);
assert.equal(tts.body.input.voice_id, "Ashley");
assert.match(tts.body.input.text, /^\[say with upbeat radio energy\]/);

console.log("generation model checks passed");
