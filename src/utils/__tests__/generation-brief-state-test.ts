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
