export type CreativeLanguage = "en" | "es";

export type DjDraftTraits = {
  genres: string[];
  moods: string[];
  energy: number;
  isInstrumental: boolean;
  vibe: string | null;
};

export type DjTraitSnapshot = {
  genres: string[];
  moods: string[];
  energy: number;
  vibe: string | null;
  identityConcept: string | null;
};

export type DjIdentityCandidate = {
  name: string;
  identityConcept: string;
};

export type GenerationMode = "instrumental" | "vocal";
export type TrackVisibility = "private" | "public";

export type GenerationBriefDraft = {
  title: string;
  creativeDirection: string;
  mode: GenerationMode;
  lyricTheme: string | null;
  lyrics: string | null;
  visibility: TrackVisibility;
  traitSnapshot: DjTraitSnapshot;
};

export type ConfirmedGenerationBriefV1 = GenerationBriefDraft & {
  version: 1;
};

export type ProductionSection = {
  name:
    | "intro"
    | "verse"
    | "pre_chorus"
    | "chorus"
    | "bridge"
    | "break"
    | "solo"
    | "outro";
  startSeconds: number;
  endSeconds: number;
  direction: string;
};

export type CreativeProductionPlanV1 = {
  bpm: number;
  key: string;
  meter: "4/4" | "3/4" | "6/8";
  sections: ProductionSection[];
  leadInstruments: string[];
  rhythmInstruments: string[];
  textureInstruments: string[];
  energyArc: string;
  productionCharacter: string[];
  vocalDirection: string | null;
  visual: {
    concept: string;
    subject: string;
    medium: string;
    composition: string;
    palette: string[];
    lighting: string;
    texture: string;
  };
  novelty: {
    coreMotifs: string[];
    avoidRecentMotifs: string[];
  };
};

export type ConfirmedGenerationBriefV2 = Omit<
  ConfirmedGenerationBriefV1,
  "version"
> & {
  version: 2;
  productionPlan: CreativeProductionPlanV1;
};

export type ConfirmedGenerationBrief =
  | ConfirmedGenerationBriefV1
  | ConfirmedGenerationBriefV2;

export type TrackDraftKind =
  | "track-brief"
  | "track-title"
  | "lyrics"
  | "creative-direction";

export type CreativeDraftRequest =
  | {
      version: 1;
      kind: "dj-identity";
      language: CreativeLanguage;
      traits: DjDraftTraits;
      exclude?: string[];
    }
  | {
      version: 1;
      kind: TrackDraftKind;
      language: CreativeLanguage;
      djId: string;
      current: Partial<GenerationBriefDraft>;
      exclude?: string[];
    };

export type IdentityDraftResponse = {
  version: 1;
  kind: "dj-identity";
  draft: { candidates: DjIdentityCandidate[] };
};

export type TrackBriefDraftResponse = {
  version: 1;
  kind: "track-brief";
  draft: Pick<
    GenerationBriefDraft,
    "title" | "creativeDirection" | "lyricTheme" | "lyrics"
  > & { productionPlan: CreativeProductionPlanV1 };
};

export type TrackTitleDraftResponse = {
  version: 1;
  kind: "track-title";
  draft: Pick<GenerationBriefDraft, "title">;
};

export type LyricsDraftResponse = {
  version: 1;
  kind: "lyrics";
  draft: Pick<GenerationBriefDraft, "lyricTheme" | "lyrics">;
};

export type CreativeDirectionDraftResponse = {
  version: 1;
  kind: "creative-direction";
  draft: Pick<GenerationBriefDraft, "creativeDirection">;
};

export type CreativeDraftResponse =
  | IdentityDraftResponse
  | TrackBriefDraftResponse
  | TrackTitleDraftResponse
  | LyricsDraftResponse
  | CreativeDirectionDraftResponse;
