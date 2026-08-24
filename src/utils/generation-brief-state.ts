import type {
  ConfirmedGenerationBrief,
  CreativeProductionPlanV1,
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
  productionPlan: CreativeProductionPlanV1 | null;
  planStatus: "missing" | "fresh" | "stale";
  confirmed: ConfirmedGenerationBrief | null;
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
  productionPlan: CreativeProductionPlanV1 | null = null,
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
    productionPlan: productionPlan ? cloneProductionPlan(productionPlan) : null,
    planStatus: productionPlan ? "fresh" : "missing",
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
    planStatus:
      state.productionPlan &&
        (field === "creativeDirection" || field === "lyricTheme" || field === "lyrics")
        ? "stale"
        : state.planStatus,
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
  return {
    ...state,
    draft,
    exclusions,
    confirmed: null,
    planStatus:
      state.productionPlan && (field === "creativeDirection" || field === "lyrics")
        ? "stale"
        : state.planStatus,
  };
}

export function markTraitsStale(
  state: GenerationBriefState,
): GenerationBriefState {
  return {
    ...state,
    isTraitSnapshotStale: true,
    confirmed: null,
    planStatus: state.productionPlan ? "stale" : state.planStatus,
  };
}

function cloneProductionPlan(
  plan: CreativeProductionPlanV1,
): CreativeProductionPlanV1 {
  return {
    ...plan,
    sections: plan.sections.map((section) => ({ ...section })),
    leadInstruments: [...plan.leadInstruments],
    rhythmInstruments: [...plan.rhythmInstruments],
    textureInstruments: [...plan.textureInstruments],
    productionCharacter: [...plan.productionCharacter],
    visual: { ...plan.visual, palette: [...plan.visual.palette] },
    novelty: {
      coreMotifs: [...plan.novelty.coreMotifs],
      avoidRecentMotifs: [...plan.novelty.avoidRecentMotifs],
    },
  };
}

function reconciledProductionPlan(
  plan: CreativeProductionPlanV1,
  draft: GenerationBriefDraft,
): CreativeProductionPlanV1 {
  const next = cloneProductionPlan(plan);
  const prefix = "Confirmed musical arc: ";
  next.energyArc = `${prefix}${draft.creativeDirection.trim()}`.slice(0, 300);
  if (draft.mode === "instrumental") {
    next.vocalDirection = null;
  } else {
    const spanish = /\[(?:verso|coro|estribillo)/i.test(draft.lyrics ?? "");
    const locale = spanish
      ? "Neutral Latin American Spanish"
      : "Natural contemporary English";
    next.vocalDirection =
      `${locale}; sing the supplied lyrics exactly, with intimate verses and a clearly contrasted hook.`
        .slice(0, 240);
  }
  return next;
}

function freezeProductionPlan(
  plan: CreativeProductionPlanV1,
): CreativeProductionPlanV1 {
  plan.sections.forEach(Object.freeze);
  Object.freeze(plan.sections);
  Object.freeze(plan.leadInstruments);
  Object.freeze(plan.rhythmInstruments);
  Object.freeze(plan.textureInstruments);
  Object.freeze(plan.productionCharacter);
  Object.freeze(plan.visual.palette);
  Object.freeze(plan.visual);
  Object.freeze(plan.novelty.coreMotifs);
  Object.freeze(plan.novelty.avoidRecentMotifs);
  Object.freeze(plan.novelty);
  return Object.freeze(plan);
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
  const base = {
    ...state.draft,
    traitSnapshot,
  };
  if (!state.productionPlan) {
    const confirmed = Object.freeze({ version: 1 as const, ...base });
    return { ...state, confirmed, planStatus: "missing" };
  }
  const productionPlan = freezeProductionPlan(
    state.planStatus === "stale"
      ? reconciledProductionPlan(state.productionPlan, state.draft)
      : cloneProductionPlan(state.productionPlan),
  );
  const confirmed = Object.freeze({
    version: 2 as const,
    ...base,
    productionPlan,
  });
  return {
    ...state,
    productionPlan,
    planStatus: "fresh",
    confirmed,
  };
}
