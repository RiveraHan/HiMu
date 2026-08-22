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
  >;
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
