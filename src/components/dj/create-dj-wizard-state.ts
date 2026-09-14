import type { DjIdentityDraftValue } from "@/src/components/dj/DjIdentityDraftStep";
import type { CreateDJInput } from "@/src/hooks/use-create-dj";
import type { FirstTrackReturnIntent } from "@/src/experience/pending-intent";
import type { Visibility } from "@/src/types/content-visibility";
import { DJ_MOODS, GENRES } from "@/src/types/music-preferences";

export type CreateDjStep = "sound" | "identity" | "review";
export type DjIntensityChoice = "calm" | "balanced" | "intense";
export type IdentityFreshness = "missing" | "fresh" | "stale";

export type DjSoundDraft = Readonly<{
  genres: string[];
  moods: string[];
  intensity: DjIntensityChoice;
  mode: "instrumental" | "vocal";
  vibe: string;
}>;

export type CreateDjWizardState = Readonly<{
  step: CreateDjStep;
  sound: DjSoundDraft;
  identity: DjIdentityDraftValue;
  identityFingerprint: string | null;
  identityFreshness: IdentityFreshness;
  visibility: Visibility;
  returnIntent: FirstTrackReturnIntent;
  dirty: boolean;
}>;

export const DJ_INTENSITY_ENERGY = { calm: 3, balanced: 6, intense: 9 } as const;

export function intensityToEnergy(intensity: DjIntensityChoice): number {
  return DJ_INTENSITY_ENERGY[intensity];
}

export function energyToIntensity(energy: number): DjIntensityChoice {
  if (energy <= 4) return "calm";
  if (energy <= 7) return "balanced";
  return "intense";
}

/** Keeps a legacy numeric value until the user chooses a different band. */
export function applyExplicitIntensity(
  energy: number,
  intensity: DjIntensityChoice,
): number {
  return energyToIntensity(energy) === intensity ? energy : intensityToEnergy(intensity);
}

export type CreateDjWizardEvent =
  | { type: "sound_changed"; patch: Partial<DjSoundDraft> }
  | { type: "identity_changed"; value: DjIdentityDraftValue }
  | { type: "visibility_changed"; visibility: Visibility }
  | { type: "step_requested"; step: CreateDjStep }
  | { type: "discard" }
  | { type: "return_intent_consumed" };

const defaultIdentity: DjIdentityDraftValue = {
  name: "",
  identityConcept: "",
  provenance: "custom",
  confirmed: false,
};

const defaultSound: DjSoundDraft = {
  genres: [],
  moods: [],
  intensity: "balanced",
  mode: "instrumental",
  vibe: "",
};

export function normalizeDjVibe(vibe: string): string {
  return vibe.trim().replace(/\s+/g, " ");
}

export function createDjTraitsFingerprint(sound: DjSoundDraft): string {
  return JSON.stringify([
    sound.genres,
    sound.moods,
    intensityToEnergy(sound.intensity),
    sound.mode,
    normalizeDjVibe(sound.vibe),
  ]);
}

export function createInitialCreateDjWizardState(
  returnIntent: FirstTrackReturnIntent = null,
): CreateDjWizardState {
  return {
    step: "sound",
    sound: { ...defaultSound, genres: [], moods: [] },
    identity: { ...defaultIdentity },
    identityFingerprint: null,
    identityFreshness: "missing",
    visibility: "private",
    returnIntent,
    dirty: false,
  };
}

function canConfirmIdentity(identity: DjIdentityDraftValue): boolean {
  const name = identity.name.trim();
  const concept = identity.identityConcept.trim();
  return name.length >= 2 && name.length <= 24 && concept.length >= 10 && concept.length <= 240;
}

function isUniqueCanonicalSelection(values: readonly string[], allowed: readonly string[]): boolean {
  return values.length >= 1 && values.length <= 3 &&
    new Set(values).size === values.length &&
    values.every((value) => allowed.includes(value));
}

function hasValidSound(state: CreateDjWizardState): boolean {
  return isUniqueCanonicalSelection(state.sound.genres, GENRES) &&
    isUniqueCanonicalSelection(state.sound.moods, DJ_MOODS) &&
    normalizeDjVibe(state.sound.vibe).length <= 140;
}

export function canEnterCreateDjStep(
  state: CreateDjWizardState,
  step: CreateDjStep,
): boolean {
  if (step === "sound") return true;
  if (!hasValidSound(state)) return false;
  if (step === "identity") return true;
  return state.identityFreshness === "fresh" && state.identity.confirmed &&
    canConfirmIdentity(state.identity) &&
    state.identityFingerprint === createDjTraitsFingerprint(state.sound);
}

function reduceSoundChanged(
  state: CreateDjWizardState,
  patch: Partial<DjSoundDraft>,
): CreateDjWizardState {
  const sound: DjSoundDraft = {
    ...state.sound,
    ...patch,
    genres: patch.genres ? [...patch.genres] : [...state.sound.genres],
    moods: patch.moods ? [...patch.moods] : [...state.sound.moods],
    vibe: patch.vibe === undefined ? state.sound.vibe : patch.vibe,
  };
  const changed = createDjTraitsFingerprint(sound) !== createDjTraitsFingerprint(state.sound);
  if (!changed) return state;
  return {
    ...state,
    sound,
    dirty: true,
    identityFreshness: state.identity.name || state.identity.identityConcept ? "stale" : "missing",
    identity: { ...state.identity, confirmed: false },
  };
}

export function reduceCreateDjWizard(
  state: CreateDjWizardState,
  event: CreateDjWizardEvent,
): CreateDjWizardState {
  switch (event.type) {
    case "sound_changed":
      return reduceSoundChanged(state, event.patch);
    case "identity_changed": {
      const identity = { ...event.value };
      const valid = identity.confirmed && canConfirmIdentity(identity);
      return {
        ...state,
        identity,
        identityFingerprint: valid ? createDjTraitsFingerprint(state.sound) : state.identityFingerprint,
        identityFreshness: valid ? "fresh" : state.identityFreshness === "stale" ? "stale" : "missing",
        dirty: true,
      };
    }
    case "visibility_changed":
      return state.visibility === event.visibility ? state : { ...state, visibility: event.visibility, dirty: true };
    case "step_requested":
      return canEnterCreateDjStep(state, event.step) ? { ...state, step: event.step } : state;
    case "discard":
      return createInitialCreateDjWizardState(state.returnIntent);
    case "return_intent_consumed":
      return state.returnIntent === null ? state : { ...state, returnIntent: null };
  }
}

export function isCreateDjWizardValid(state: CreateDjWizardState): boolean {
  return state.step === "review" && canEnterCreateDjStep(state, "review");
}

export function toCreateDjInput(state: CreateDjWizardState): CreateDJInput {
  if (!isCreateDjWizardValid(state)) throw new Error("create_dj_state_invalid");
  return {
    name: state.identity.name.trim(),
    identityConcept: state.identity.identityConcept.trim(),
    genres: [...state.sound.genres],
    moods: [...state.sound.moods],
    energy: intensityToEnergy(state.sound.intensity),
    isInstrumental: state.sound.mode === "instrumental",
    vibe: normalizeDjVibe(state.sound.vibe) || undefined,
    isPublic: state.visibility === "public",
  };
}
