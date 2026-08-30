import type { ExperienceAction } from "@/shared/experience-action";
import { secureStorage } from "@/src/lib/secure-storage";
import {
  BETA_SMOKE_TRACK_ID,
  BETA_SMOKE_USER_ID,
  betaSmokeExperienceState,
  transitionBetaSmokeExperience,
  type BetaSmokeExperienceState,
} from "@/src/beta-smoke";
import {
  DEFAULT_MUSIC_PREFERENCES,
  type MusicPreferences,
} from "@/src/types/music-preferences";

const STORAGE_KEY = "himu.beta-smoke.experience.v1";
const PREFERENCES_KEY = "himu.beta-smoke.preferences.v1";

function isSmokeUser(userId: string): boolean {
  return userId === BETA_SMOKE_USER_ID;
}

function parseState(raw: string | null): BetaSmokeExperienceState {
  if (!raw) return betaSmokeExperienceState();
  try {
    const value = JSON.parse(raw) as Partial<BetaSmokeExperienceState>;
    const statuses = new Set<BetaSmokeExperienceState["preferenceNudgeStatus"]>([
      "ineligible",
      "eligible",
      "shown",
      "dismissed",
      "completed",
    ]);
    if (
      value.introVersionSeen !== 1 ||
      typeof value.firstOwnedTrackId !== "string" && value.firstOwnedTrackId !== null ||
      typeof value.firstOwnedTrackReadyAt !== "string" && value.firstOwnedTrackReadyAt !== null ||
      typeof value.preferenceNudgeTrackId !== "string" && value.preferenceNudgeTrackId !== null ||
      typeof value.preferenceNudgeStatus !== "string" ||
      !statuses.has(value.preferenceNudgeStatus as BetaSmokeExperienceState["preferenceNudgeStatus"])
    ) return betaSmokeExperienceState();
    return value as BetaSmokeExperienceState;
  } catch {
    return betaSmokeExperienceState();
  }
}

export async function readBetaSmokeExperienceState(
  userId: string,
): Promise<BetaSmokeExperienceState> {
  if (!isSmokeUser(userId)) return betaSmokeExperienceState();
  return parseState(await secureStorage.getItem(STORAGE_KEY));
}

async function writeState(state: BetaSmokeExperienceState): Promise<BetaSmokeExperienceState> {
  await secureStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export async function markBetaSmokeTrackReady(
  userId: string,
): Promise<BetaSmokeExperienceState> {
  if (!isSmokeUser(userId)) return betaSmokeExperienceState();
  const current = await readBetaSmokeExperienceState(userId);
  if (current.preferenceNudgeStatus !== "ineligible") return current;
  return writeState({
    ...current,
    firstOwnedTrackId: BETA_SMOKE_TRACK_ID,
    firstOwnedTrackReadyAt: "2026-08-29T00:00:00.000Z",
    preferenceNudgeStatus: "eligible",
    preferenceNudgeTrackId: BETA_SMOKE_TRACK_ID,
  });
}

export async function applyBetaSmokeExperienceAction(
  userId: string,
  action: ExperienceAction,
): Promise<BetaSmokeExperienceState> {
  if (!isSmokeUser(userId)) return betaSmokeExperienceState();
  const current = await readBetaSmokeExperienceState(userId);
  return writeState(transitionBetaSmokeExperience(current, action));
}

function parsePreferences(raw: string | null): MusicPreferences {
  if (!raw) return DEFAULT_MUSIC_PREFERENCES;
  try {
    const value = JSON.parse(raw) as Partial<MusicPreferences>;
    const atmosphere = value.atmosphere;
    if (
      !Array.isArray(value.genres) ||
      !Array.isArray(value.excludedMoods) ||
      !value.genres.every((item) => typeof item === "string") ||
      !value.excludedMoods.every((item) => typeof item === "string") ||
      (atmosphere !== "calm" && atmosphere !== "balanced" && atmosphere !== "intense")
    ) return DEFAULT_MUSIC_PREFERENCES;
    return {
      genres: [...value.genres],
      excludedMoods: [...value.excludedMoods],
      atmosphere,
    };
  } catch {
    return DEFAULT_MUSIC_PREFERENCES;
  }
}

export async function readBetaSmokeMusicPreferences(
  userId: string,
): Promise<MusicPreferences> {
  if (!isSmokeUser(userId)) return DEFAULT_MUSIC_PREFERENCES;
  return parsePreferences(await secureStorage.getItem(PREFERENCES_KEY));
}

export async function writeBetaSmokeMusicPreferences(
  userId: string,
  preferences: MusicPreferences,
): Promise<void> {
  if (!isSmokeUser(userId)) return;
  await secureStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}
