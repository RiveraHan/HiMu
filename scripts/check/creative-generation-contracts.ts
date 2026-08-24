import assert from "node:assert/strict";

import {
  buildCreativeDraftModelInput,
  extractRecentCreativeMemory,
  parseCreativeDraftOutput,
  sameTraitSnapshot,
  validateConfirmedBrief,
  validateCreativeDraftRequest,
  validateProductionPlan,
} from "../../supabase/functions/_shared/creative-generation.ts";
import {
  buildAvatarPrompt,
  buildBasePrompt,
  buildDjIdentityFields,
  validateDjInput,
} from "../../supabase/functions/_shared/dj-input.ts";

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

const validProductionPlan = {
  bpm: 118,
  key: "F# minor",
  meter: "4/4" as const,
  sections: [
    {
      name: "intro" as const,
      startSeconds: 0,
      endSeconds: 18,
      direction: "Filtered percussion reveals the glass motif one layer at a time.",
    },
    {
      name: "verse" as const,
      startSeconds: 18,
      endSeconds: 58,
      direction: "Intimate lead vocal over restrained bass and dry rim clicks.",
    },
    {
      name: "chorus" as const,
      startSeconds: 58,
      endSeconds: 96,
      direction: "Open the stereo field and answer the hook with bright mallets.",
    },
    {
      name: "outro" as const,
      startSeconds: 96,
      endSeconds: 120,
      direction: "Let the motif dissolve into rain-like delays without a hard stop.",
    },
  ],
  leadInstruments: ["glass mallets", "breathy alto voice"],
  rhythmInstruments: ["round sub bass", "dry rim clicks"],
  textureInstruments: ["tape hiss", "rain-like delays"],
  energyArc: "Patient ascent from close-mic restraint to a luminous, wide final chorus.",
  productionCharacter: ["warm analog saturation", "precise transient detail"],
  vocalDirection:
    "Neutral Latin American Spanish, intimate verses and a clear, sustained chorus hook.",
  visual: {
    concept: "A fragile signal becoming a shared constellation in the rain.",
    subject: "Translucent antenna forms suspended above a wet rooftop",
    medium: "Layered paper sculpture photographed on medium-format film",
    composition: "Asymmetric square frame with the main form rising from the lower third",
    palette: ["smoked indigo", "warm amber", "frosted cyan"],
    lighting: "Low amber side light with soft cyan reflections",
    texture: "Visible paper fibers, fine rain grain, and restrained halation",
  },
  novelty: {
    coreMotifs: ["glass antenna call-and-response", "ascending three-note signal"],
    avoidRecentMotifs: ["neon tunnel", "four-on-the-floor piano hook"],
  },
};

const validBriefV2 = {
  ...validBrief,
  version: 2 as const,
  productionPlan: validProductionPlan,
};

const confirmedDj = validateDjInput({
  name: "Static Bloom",
  identityConcept: "A patient selector tracing city lights through warm analog haze.",
  ...traits,
});
assert.equal(confirmedDj.ok, true);
if (!confirmedDj.ok) throw new Error("expected valid DJ input");
assert.equal(
  confirmedDj.data.identityConcept,
  "A patient selector tracing city lights through warm analog haze.",
);
assert.match(buildBasePrompt(confirmedDj.data), /patient selector/i);
assert.deepEqual(buildDjIdentityFields(confirmedDj.data), {
  character: "Rain-lit rooftop after midnight",
  identity_concept:
    "A patient selector tracing city lights through warm analog haze.",
});
const avatarPrompt = buildAvatarPrompt(
  confirmedDj.data.genres,
  confirmedDj.data.moods,
  confirmedDj.data.identityConcept,
  "dj-static-bloom:avatar-v2",
);
assert.match(avatarPrompt, /patient selector/i);
assert.match(avatarPrompt, /fictional adult DJ persona/i);
assert.match(avatarPrompt, /no celebrity likeness/i);
assert.match(avatarPrompt, /no text, no typography/i);
assert.equal(validateDjInput({ name: "Static Bloom", ...traits }).ok, false);
assert.equal(
  validateDjInput({
    name: "Static Bloom",
    identityConcept: "https://example.com is my concept",
    ...traits,
  }).ok,
  false,
);
assert.equal(
  validateDjInput({
    name: "Static Bloom",
    identityConcept: `Patient selector ${"x".repeat(230)}`,
    ...traits,
  }).ok,
  false,
);

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
const confirmedV2 = validateConfirmedBrief(validBriefV2, authoritative, "en", 120);
assert.equal(confirmedV2.version, 2);
if (confirmedV2.version !== 2) throw new Error("expected V2 brief");
assert.deepEqual(confirmedV2.productionPlan, validProductionPlan);
assert.equal(confirmedV2.title, validBriefV2.title);
assert.equal(confirmedV2.creativeDirection, validBriefV2.creativeDirection);
assert.equal(confirmedV2.lyricTheme, validBriefV2.lyricTheme);
assert.equal(confirmedV2.lyrics, validBriefV2.lyrics);

assert.deepEqual(
  validateProductionPlan(validProductionPlan, {
    mode: "vocal",
    durationSeconds: 120,
  }),
  validProductionPlan,
);
for (const bpm of [44, 191, 118.5]) {
  assert.throws(
    () => validateProductionPlan(
      { ...validProductionPlan, bpm },
      { mode: "vocal", durationSeconds: 120 },
    ),
    /production_bpm/,
  );
}
assert.throws(
  () => validateProductionPlan(
    { ...validProductionPlan, key: "F sharp minor" },
    { mode: "vocal", durationSeconds: 120 },
  ),
  /production_key/,
);
assert.throws(
  () => validateProductionPlan(
    { ...validProductionPlan, meter: "5/4" },
    { mode: "vocal", durationSeconds: 120 },
  ),
  /production_meter/,
);
assert.throws(
  () => validateProductionPlan(
    {
      ...validProductionPlan,
      sections: [
        validProductionPlan.sections[0],
        { ...validProductionPlan.sections[1], startSeconds: 17 },
      ],
    },
    { mode: "vocal", durationSeconds: 120 },
  ),
  /production_sections_order/,
);
assert.throws(
  () => validateProductionPlan(
    {
      ...validProductionPlan,
      sections: validProductionPlan.sections.map((section, index) =>
        index === validProductionPlan.sections.length - 1
          ? { ...section, endSeconds: 121 }
          : section
      ),
    },
    { mode: "vocal", durationSeconds: 120 },
  ),
  /production_sections_duration/,
);
assert.throws(
  () => validateProductionPlan(
    { ...validProductionPlan, leadInstruments: [] },
    { mode: "vocal", durationSeconds: 120 },
  ),
  /lead_instruments_limit/,
);
assert.throws(
  () => validateProductionPlan(
    {
      ...validProductionPlan,
      visual: { ...validProductionPlan.visual, palette: ["indigo"] },
    },
    { mode: "vocal", durationSeconds: 120 },
  ),
  /visual_palette_limit/,
);
assert.throws(
  () => validateProductionPlan(
    {
      ...validProductionPlan,
      novelty: {
        ...validProductionPlan.novelty,
        avoidRecentMotifs: Array.from({ length: 11 }, (_, index) => `motif ${index}`),
      },
    },
    { mode: "vocal", durationSeconds: 120 },
  ),
  /avoid_recent_motifs_limit/,
);
assert.throws(
  () => validateProductionPlan(
    { ...validProductionPlan, vocalDirection: null },
    { mode: "vocal", durationSeconds: 120 },
  ),
  /vocal_direction/,
);
assert.throws(
  () => validateProductionPlan(
    validProductionPlan,
    { mode: "instrumental", durationSeconds: 120 },
  ),
  /instrumental_vocal_direction/,
);
assert.equal(
  validateProductionPlan(
    { ...validProductionPlan, vocalDirection: null },
    { mode: "instrumental", durationSeconds: 120 },
  ).vocalDirection,
  null,
);
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

const trackModelInput = buildCreativeDraftModelInput(
  {
    version: 1,
    kind: "track-brief",
    language: "es",
    djId: "dj-1",
    current: {
      title: "",
      creativeDirection: "",
      mode: "vocal",
      lyricTheme: "elegir la esperanza sin negar el miedo",
      lyrics: "",
    },
    exclude: ["Luz de Medianoche"],
  },
  {
    djContext: authoritative,
    durationSeconds: 120,
    recentMemory: {
      titles: ["Cables Bajo la Lluvia"],
      identityNames: ["Static Bloom"],
      visualMotifs: ["túnel de neón"],
      hooks: ["subida de tres notas"],
      productionFingerprints: ["piano house a cuatro pulsos"],
    },
  },
);
assert.equal(trackModelInput.promptVersion, "creative-brief-v2.es");
assert.equal(trackModelInput.role, "creative_longform");
assert.equal(trackModelInput.maxOutputTokens, 1_200);
assert.match(trackModelInput.systemPrompt, /concrete imagery/i);
assert.match(trackModelInput.systemPrompt, /point of view/i);
assert.match(trackModelInput.systemPrompt, /singable/i);
assert.match(trackModelInput.systemPrompt, /section contrast/i);
assert.match(trackModelInput.systemPrompt, /clich/i);
assert.match(trackModelInput.systemPrompt, /neutral Latin American Spanish/i);
assert.match(trackModelInput.systemPrompt, /under 3,600 characters/i);
assert.match(trackModelInput.systemPrompt, /\[Verso\].*\[Coro\]/i);
assert.match(trackModelInput.systemPrompt, /intro, verse, pre_chorus, chorus, bridge, break, solo, outro/i);
assert.match(trackModelInput.systemPrompt, /English machine labels even when the content is Spanish/i);
assert.match(trackModelInput.systemPrompt, /escape every lyric line break as \\n/i);
assert.match(trackModelInput.prompt, /Cables Bajo la Lluvia/);
assert.match(trackModelInput.prompt, /túnel de neón/);
assert.match(trackModelInput.prompt, /piano house a cuatro pulsos/);
assert.match(trackModelInput.prompt, /"durationSeconds":120/);

const parsedV2Draft = parseCreativeDraftOutput(
  "track-brief",
  JSON.stringify({
    title: validBrief.title,
    creativeDirection: validBrief.creativeDirection,
    lyricTheme: validBrief.lyricTheme,
    lyrics: validBrief.lyrics,
    productionPlan: validProductionPlan,
  }),
  {
    language: "en",
    exclude: [],
    djName: authoritative.djName,
    mode: "vocal",
    durationSeconds: 120,
  },
);
assert.deepEqual(parsedV2Draft.productionPlan, validProductionPlan);

const derivedMemory = extractRecentCreativeMemory(
  [
    {
      ...validBriefV2,
      lyrics: "PRIVATE RAW LYRICS MUST NEVER ENTER MEMORY",
    },
  ],
  ["Older Track"],
);
assert.deepEqual(derivedMemory.titles, ["Older Track", "Glass Antennas"]);
assert.deepEqual(
  derivedMemory.visualMotifs,
  [validProductionPlan.visual.concept],
);
assert.deepEqual(
  derivedMemory.hooks,
  validProductionPlan.novelty.coreMotifs,
);
assert.equal(derivedMemory.productionFingerprints.length, 1);
assert.doesNotMatch(JSON.stringify(derivedMemory), /PRIVATE RAW LYRICS/);
assert.throws(
  () => parseCreativeDraftOutput(
    "track-brief",
    JSON.stringify({
      title: validBrief.title,
      creativeDirection: validBrief.creativeDirection,
      lyricTheme: validBrief.lyricTheme,
      lyrics: validBrief.lyrics,
    }),
    {
      language: "en",
      exclude: [],
      djName: authoritative.djName,
      mode: "vocal",
      durationSeconds: 120,
    },
  ),
  /production_plan_type/,
);

console.log("creative generation contract checks passed");
