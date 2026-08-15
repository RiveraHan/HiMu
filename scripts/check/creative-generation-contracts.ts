import assert from "node:assert/strict";

import {
  buildCreativeDraftModelInput,
  parseCreativeDraftOutput,
  sameTraitSnapshot,
  validateConfirmedBrief,
  validateCreativeDraftRequest,
} from "../../supabase/functions/_shared/creative-generation.ts";

const traits = {
  genres: ["House"],
  moods: ["Dreamy"],
  energy: 6,
  isInstrumental: false,
  vibe: "Rain-lit rooftop after midnight",
};

const authoritative = {
  djName: "Static Bloom",
  genres: ["House"],
  moods: ["Dreamy"],
  energy: 6,
  isInstrumental: false,
  vibe: "Rain-lit rooftop after midnight",
  identityConcept: "A patient selector tracing city lights through warm analog haze.",
};

const validBrief = {
  version: 1 as const,
  title: "Glass Antennas",
  creativeDirection:
    "A gradual nocturnal build where warm bass and glassy percussion answer each other.",
  mode: "vocal" as const,
  lyricTheme: "Choosing wonder over certainty",
  lyrics:
    "[Verse 1]\nStreetlights draw a map across the rain\n[Chorus]\nWe choose the glow and start again",
  visibility: "private" as const,
  traitSnapshot: {
    genres: ["House"],
    moods: ["Dreamy"],
    energy: 6,
    vibe: "Rain-lit rooftop after midnight",
    identityConcept:
      "A patient selector tracing city lights through warm analog haze.",
  },
};

// Request discriminants and exact input boundaries.
assert.equal(
  validateCreativeDraftRequest({
    version: 1,
    kind: "dj-identity",
    language: "en",
    traits,
    exclude: Array.from({ length: 10 }, (_, index) => `Past name ${index}`),
  }).kind,
  "dj-identity",
);
assert.throws(
  () =>
    validateCreativeDraftRequest({
      version: 1,
      kind: "dj-identity",
      language: "en",
      traits,
      exclude: Array.from({ length: 11 }, (_, index) => `Past name ${index}`),
    }),
  /exclude_limit/,
);
assert.throws(
  () =>
    validateCreativeDraftRequest({
      version: 1,
      kind: "track-title",
      language: "en",
      djId: "dj-1",
      current: {},
      exclude: ["x".repeat(81)],
    }),
  /exclude_length/,
);
assert.throws(
  () =>
    validateCreativeDraftRequest({
      version: 2,
      kind: "dj-identity",
      language: "en",
      traits,
    }),
  /version/,
);
assert.throws(
  () =>
    validateCreativeDraftRequest({
      version: 1,
      kind: "dj-identity",
      language: "fr",
      traits,
    }),
  /language/,
);

// Model output must be strict JSON, complete, bounded, and locally original.
assert.deepEqual(
  parseCreativeDraftOutput(
    "dj-identity",
    JSON.stringify({
      candidates: [
        {
          name: "Static Bloom",
          identityConcept:
            "A patient selector tracing city lights through warm analog haze.",
        },
        {
          name: "Velvet Index",
          identityConcept:
            "A curious archivist reshaping forgotten dance floors into intimate rituals.",
        },
        {
          name: "Orbit Mercy",
          identityConcept:
            "A celestial night guide balancing kinetic rhythm with moments of quiet gravity.",
        },
      ],
    }),
    { language: "en", exclude: [] },
  ).candidates.map((candidate) => candidate.name),
  ["Static Bloom", "Velvet Index", "Orbit Mercy"],
);
assert.throws(
  () =>
    parseCreativeDraftOutput(
      "dj-identity",
      JSON.stringify({
        candidates: [
          { name: "Static Bloom", identityConcept: "A deliberate nocturnal selector with an analog heart." },
          { name: " static   bloom ", identityConcept: "A distinct but duplicate normalized identity concept." },
          { name: "Orbit Mercy", identityConcept: "A celestial guide balancing motion with quiet gravity." },
        ],
      }),
      { language: "en", exclude: [] },
    ),
  /duplicate_identity/,
);
assert.throws(
  () => parseCreativeDraftOutput("track-title", "```json\n{\"title\":\"Blue Static\"}\n```", { language: "en", exclude: [] }),
  /invalid_json/,
);
assert.throws(
  () => parseCreativeDraftOutput("track-title", JSON.stringify({ title: "Neon Pulse" }), { language: "en", exclude: [] }),
  /generic_title/,
);
assert.throws(
  () => parseCreativeDraftOutput("track-title", JSON.stringify({ title: "Safe\u0007Title" }), { language: "en", exclude: [] }),
  /control_character/,
);

const englishLyrics = parseCreativeDraftOutput(
  "lyrics",
  JSON.stringify({
    lyricTheme: "Taking the unfamiliar road home",
    lyrics: "[Verse 1]\nThe compass shakes beneath my hand\n[Chorus]\nI take the road I understand",
  }),
  { language: "en", exclude: [] },
);
assert.match(englishLyrics.lyrics, /\[Chorus\]/);
const spanishLyrics = parseCreativeDraftOutput(
  "lyrics",
  JSON.stringify({
    lyricTheme: "Volver a elegir el camino",
    lyrics: "[Verso 1]\nLa brújula tiembla en mi mano\n[Coro]\nElijo de nuevo el camino",
  }),
  { language: "es", exclude: [] },
);
assert.match(spanishLyrics.lyrics, /\[Coro\]/);
assert.throws(
  () =>
    parseCreativeDraftOutput(
      "lyrics",
      JSON.stringify({ lyricTheme: "Finding the road", lyrics: "[Verse 1]\nOnly a verse" }),
      { language: "en", exclude: [] },
    ),
  /lyrics_structure/,
);

// Confirmation rejects stale traits and incompatible vocal/instrumental data.
assert.equal(validateConfirmedBrief(validBrief, authoritative).version, 1);
assert.throws(
  () => validateConfirmedBrief({ ...validBrief, title: "Neon Pulse" }, authoritative),
  /generic_title/,
);
assert.throws(
  () =>
    validateConfirmedBrief(
      { ...validBrief, mode: "instrumental", lyricTheme: null, lyrics: validBrief.lyrics },
      { ...authoritative, isInstrumental: true },
    ),
  /instrumental_lyrics/,
);
assert.throws(
  () =>
    validateConfirmedBrief(
      {
        ...validBrief,
        traitSnapshot: { ...validBrief.traitSnapshot, energy: 7 },
      },
      authoritative,
    ),
  /brief_stale/,
);
assert.equal(
  sameTraitSnapshot(validBrief.traitSnapshot, {
    ...validBrief.traitSnapshot,
    genres: [...validBrief.traitSnapshot.genres],
  }),
  true,
);

const modelInput = buildCreativeDraftModelInput(
  {
    version: 1,
    kind: "dj-identity",
    language: "es",
    traits,
    exclude: ["Static Bloom"],
  },
  { existingDjNames: ["Velvet Index"] },
);
assert.match(modelInput.systemPrompt, /JSON only/i);
assert.match(modelInput.systemPrompt, /original/i);
assert.match(modelInput.systemPrompt, /named artist/i);
assert.match(modelInput.prompt, /"language":"es"/);
assert.match(modelInput.prompt, /"genres":\["House"\]/);
assert.doesNotMatch(modelInput.prompt, /service_role|oauth.*secret/i);

console.log("creative generation contract checks passed");
