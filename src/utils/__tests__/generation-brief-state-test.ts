import {
  applyRegeneratedField,
  canConfirmBrief,
  confirmBrief,
  createBriefDraft,
  editBriefField,
  markTraitsStale,
} from "../generation-brief-state";

const snapshot = {
  genres: ["House"],
  moods: ["Dreamy"],
  energy: 6,
  vibe: "Rain-lit rooftop",
  identityConcept: "A patient selector tracing city lights through warm analog haze.",
};

const productionPlan = {
  bpm: 118,
  key: "F# minor",
  meter: "4/4" as const,
  sections: [
    { name: "intro" as const, startSeconds: 0, endSeconds: 16, direction: "Reveal one glass motif over filtered percussion." },
    { name: "verse" as const, startSeconds: 16, endSeconds: 54, direction: "Keep the vocal close over restrained bass and dry rim clicks." },
    { name: "chorus" as const, startSeconds: 54, endSeconds: 94, direction: "Widen harmony and answer the hook with bright mallets." },
    { name: "outro" as const, startSeconds: 94, endSeconds: 120, direction: "Dissolve the motif into rain-like delay." },
  ],
  leadInstruments: ["glass mallets", "breathy alto voice"],
  rhythmInstruments: ["round sub bass", "dry rim clicks"],
  textureInstruments: ["tape hiss", "rain-like delay"],
  energyArc: "Rise from close-mic restraint to a luminous final chorus.",
  productionCharacter: ["warm analog saturation", "precise transient detail"],
  vocalDirection: "Natural contemporary English with intimate verses and a sustained chorus hook.",
  visual: {
    concept: "A fragile signal becomes a shared constellation in rain.",
    subject: "Translucent antenna forms above a wet rooftop",
    medium: "Layered paper sculpture photographed on film",
    composition: "Asymmetric square frame rising from the lower third",
    palette: ["smoked indigo", "warm amber", "frosted cyan"],
    lighting: "Low amber side light with cyan reflections",
    texture: "Visible paper fibers, fine rain grain, restrained halation",
  },
  novelty: {
    coreMotifs: ["glass antenna response", "ascending three-note signal"],
    avoidRecentMotifs: ["neon tunnel", "piano house hook"],
  },
};

const complete = () =>
  createBriefDraft({
    mode: "vocal",
    visibility: "private",
    traitSnapshot: snapshot,
    title: "Glass Antennas",
    creativeDirection: "Warm bass rises slowly beneath bright glass percussion.",
    lyricTheme: "Choosing wonder over certainty",
    lyrics: "[Verse 1]\nA map appears beneath the rain\n[Chorus]\nWe choose the glow and start again",
  });

const completeV2 = () => createBriefDraft(complete().draft, productionPlan);

test("a fresh production plan confirms as V2 without changing user copy", () => {
  const state = completeV2();
  const confirmed = confirmBrief(state);

  expect(state.planStatus).toBe("fresh");
  expect(confirmed.confirmed?.version).toBe(2);
  if (confirmed.confirmed?.version !== 2) throw new Error("expected V2");
  expect(confirmed.confirmed.productionPlan).toEqual(productionPlan);
  expect(confirmed.confirmed.title).toBe(state.draft.title);
  expect(confirmed.confirmed.creativeDirection).toBe(
    state.draft.creativeDirection,
  );
  expect(confirmed.confirmed.lyrics).toBe(state.draft.lyrics);
  expect(confirmed.confirmed.productionPlan).not.toBe(productionPlan);
});

test("direction and lyric edits mark the plan stale and deterministically reconcile on confirmation", () => {
  const direction = "Pull the verse inward, then let the final chorus bloom into open stereo space.";
  const edited = editBriefField(completeV2(), "creativeDirection", direction);
  expect(edited.planStatus).toBe("stale");

  const confirmed = confirmBrief(edited);
  expect(confirmed.planStatus).toBe("fresh");
  expect(confirmed.confirmed?.creativeDirection).toBe(direction);
  if (confirmed.confirmed?.version !== 2) throw new Error("expected V2");
  expect(confirmed.confirmed.productionPlan.energyArc).toContain(direction);

  const titleOnly = editBriefField(completeV2(), "title", "Signals in Glass");
  expect(titleOnly.planStatus).toBe("fresh");
});

test("editing one field preserves the rest byte-for-byte and invalidates confirmation", () => {
  const confirmed = confirmBrief(complete());
  const before = confirmed.draft;
  const edited = editBriefField(confirmed, "title", "Signals in Glass");

  expect(edited.draft.title).toBe("Signals in Glass");
  expect(edited.draft.creativeDirection).toBe(before.creativeDirection);
  expect(edited.draft.lyrics).toBe(before.lyrics);
  expect(edited.confirmed).toBeNull();
});

test("granular regeneration changes only its requested field and bounds normalized exclusions", () => {
  let state = complete();
  for (let index = 0; index < 12; index += 1) {
    state = editBriefField(state, "title", `Discarded ${index}`);
    state = applyRegeneratedField(state, "title", `Candidate ${index}`);
  }

  expect(state.draft.title).toBe("Candidate 11");
  expect(state.draft.creativeDirection).toBe(
    "Warm bass rises slowly beneath bright glass percussion.",
  );
  expect(state.exclusions.title).toHaveLength(10);
  expect(state.exclusions.title[0]).toBe("Discarded 2");
  expect(state.exclusions.title[9]).toBe("Discarded 11");
});

test("trait staleness preserves edits but blocks confirmation", () => {
  const edited = editBriefField(complete(), "title", "Signals in Glass");
  const stale = markTraitsStale(edited);

  expect(stale.draft.title).toBe("Signals in Glass");
  expect(stale.isTraitSnapshotStale).toBe(true);
  expect(canConfirmBrief(stale)).toBe(false);
  expect(() => confirmBrief(stale)).toThrow("brief_not_confirmable");
});

test("instrumental drafts reject lyric fields and freeze an independent confirmation snapshot", () => {
  const state = createBriefDraft({
    mode: "instrumental",
    visibility: "public",
    traitSnapshot: snapshot,
    title: "Glass Antennas",
    creativeDirection: "Warm bass rises slowly beneath bright glass percussion.",
    lyricTheme: null,
    lyrics: null,
  });
  const confirmed = confirmBrief(state);

  expect(confirmed.confirmed).toEqual({ version: 1, ...state.draft });
  expect(confirmed.confirmed).not.toBe(state.draft);
  expect(Object.isFrozen(confirmed.confirmed)).toBe(true);
  expect(
    canConfirmBrief(
      editBriefField(state, "lyrics", "[Verse 1]\nNo\n[Chorus]\nNo"),
    ),
  ).toBe(false);
});

test("incomplete vocal structure cannot be confirmed", () => {
  const state = editBriefField(complete(), "lyrics", "[Verse 1]\nOnly a verse");
  expect(canConfirmBrief(state)).toBe(false);
});
