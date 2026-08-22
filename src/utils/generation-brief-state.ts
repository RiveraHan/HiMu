import type {
  ConfirmedGenerationBriefV1,
  GenerationBriefDraft,
} from "@/src/types/creative-generation";

export type RegeneratableBriefField =
  | "title"
  | "creativeDirection"
  | "lyrics";
export type EditableBriefField = keyof Pick<
  GenerationBriefDraft,
  "title" | "creativeDirection" | "lyricTheme" | "lyrics" | "visibility"
>;

export type GenerationBriefState = {
  draft: GenerationBriefDraft;
  confirmed: ConfirmedGenerationBriefV1 | null;
  isTraitSnapshotStale: boolean;
  exclusions: Record<RegeneratableBriefField, string[]>;
};

const emptyExclusions = (): GenerationBriefState["exclusions"] => ({
  title: [],
  creativeDirection: [],
  lyrics: [],
});

function normalizeExclusion(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function appendExclusion(values: string[], value: string | null): string[] {
  if (!value) return values;
  const normalized = normalizeExclusion(value);
  if (!normalized) return values;
  const key = normalized.toLocaleLowerCase();
  return [
    ...values.filter((item) => item.toLocaleLowerCase() !== key),
    normalized,
  ].slice(-10);
}

export function createBriefDraft(
  draft: GenerationBriefDraft,
): GenerationBriefState {
  return {
    draft: {
      ...draft,
      traitSnapshot: {
        ...draft.traitSnapshot,
        genres: [...draft.traitSnapshot.genres],
        moods: [...draft.traitSnapshot.moods],
      },
    },
    confirmed: null,
    isTraitSnapshotStale: false,
    exclusions: emptyExclusions(),
  };
}

export function editBriefField<K extends EditableBriefField>(
  state: GenerationBriefState,
  field: K,
  value: GenerationBriefDraft[K],
): GenerationBriefState {
  return {
    ...state,
    draft: { ...state.draft, [field]: value },
    confirmed: null,
  };
}

export function applyRegeneratedField(
  state: GenerationBriefState,
  field: RegeneratableBriefField,
  value: string | { lyricTheme: string; lyrics: string },
): GenerationBriefState {
  const previous =
    field === "lyrics" ? state.draft.lyrics : state.draft[field];
  const exclusions = {
    ...state.exclusions,
    [field]: appendExclusion(state.exclusions[field], previous),
  };
  const draft = { ...state.draft };
  if (field === "lyrics" && typeof value !== "string") {
    draft.lyricTheme = value.lyricTheme;
    draft.lyrics = value.lyrics;
  } else if (field === "lyrics") {
    draft.lyrics = typeof value === "string" ? value : value.lyrics;
  } else {
    draft[field] = value as never;
  }
  return { ...state, draft, exclusions, confirmed: null };
}

export function markTraitsStale(
  state: GenerationBriefState,
): GenerationBriefState {
  return { ...state, isTraitSnapshotStale: true, confirmed: null };
}

function completeLyrics(value: string): boolean {
  const verse = /\[(?:verse|verso)(?:\s+\d+)?\]/i.test(value);
  const chorus = /\[(?:chorus|coro|estribillo)(?:\s+\d+)?\]/i.test(value);
  return verse && chorus;
}

export function canConfirmBrief(state: GenerationBriefState): boolean {
  if (state.isTraitSnapshotStale) return false;
  const { draft } = state;
  const title = draft.title.trim();
  const direction = draft.creativeDirection.trim();
  if (title.length < 2 || title.length > 80) return false;
  if (direction.length < 10 || direction.length > 500) return false;
  if (draft.mode === "instrumental") {
    return draft.lyricTheme == null && draft.lyrics == null;
  }
  const theme = draft.lyricTheme?.trim() ?? "";
  const lyrics = draft.lyrics ?? "";
  return (
    theme.length >= 2 &&
    theme.length <= 120 &&
    lyrics.length <= 1_000 &&
    completeLyrics(lyrics)
  );
}

export function confirmBrief(
  state: GenerationBriefState,
): GenerationBriefState {
  if (!canConfirmBrief(state)) throw new Error("brief_not_confirmable");
  const traitSnapshot = Object.freeze({
    ...state.draft.traitSnapshot,
    genres: Object.freeze([...state.draft.traitSnapshot.genres]) as unknown as string[],
    moods: Object.freeze([...state.draft.traitSnapshot.moods]) as unknown as string[],
  });
  const confirmed = Object.freeze({
    version: 1 as const,
    ...state.draft,
    traitSnapshot,
  });
  return { ...state, confirmed };
}
