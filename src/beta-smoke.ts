import type { ExperienceAction } from "@/shared/experience-action";
import type { PlayerTrack } from "@/src/stores/player-store";

export const BETA_SMOKE_USER_ID = "beta-smoke-local-user";
export const BETA_SMOKE_DJ_ID = "beta-smoke-dj";
export const BETA_SMOKE_TRACK_ID = "beta-smoke-track-first";

export const BETA_SMOKE_DJ = {
  id: BETA_SMOKE_DJ_ID,
  name: "Night Cartographer",
  identity_concept: "Maps patient rhythms into luminous shared journeys.",
  slug: "night-cartographer",
  avatar_url: null,
  character: "Patient, luminous and quietly exploratory.",
  genre_specialties: ["Ambient"],
  mood_tags: ["Calm"],
  is_premium: false,
  voice_style: null,
  owner_id: BETA_SMOKE_USER_ID,
  is_public: false,
  personality_traits: { energy: 6, isInstrumental: true },
};

export type BetaSmokeExperienceState = Readonly<{
  introVersionSeen: number;
  firstOwnedTrackId: string | null;
  firstOwnedTrackReadyAt: string | null;
  preferenceNudgeStatus: "ineligible" | "eligible" | "shown" | "dismissed" | "completed";
  preferenceNudgeTrackId: string | null;
}>;

export const BETA_SMOKE_TRACK: PlayerTrack = {
  id: BETA_SMOKE_TRACK_ID,
  title: "First Light",
  artist: "Night Cartographer",
  audio_url: "https://fixtures.himu.invalid/beta-smoke-track.mp3",
  album_art_url: null,
  duration: 180,
  genre: "Ambient",
  owner_id: BETA_SMOKE_USER_ID,
  is_public: false,
};

export function isBetaSmokeUserForEnvironment(
  userId: string | null | undefined,
  development: boolean,
  smokeFlag: string | undefined,
): boolean {
  return development && smokeFlag === "1" && userId === BETA_SMOKE_USER_ID;
}

export function isBetaSmokeUser(userId: string | null | undefined): boolean {
  return isBetaSmokeUserForEnvironment(
    userId,
    __DEV__,
    process.env.EXPO_PUBLIC_BETA_SMOKE,
  );
}

/**
 * The executable beta smoke fixture is deliberately narrower than the local
 * smoke user.  Only this exact track may substitute Player data boundaries;
 * a real track viewed by the same development user must keep its normal
 * behaviour.
 */
export function isBetaSmokeTrackForEnvironment(
  userId: string | null | undefined,
  trackId: string | null | undefined,
  development: boolean,
  smokeFlag: string | undefined,
): boolean {
  return trackId === BETA_SMOKE_TRACK_ID && isBetaSmokeUserForEnvironment(
    userId,
    development,
    smokeFlag,
  );
}

export function isBetaSmokeTrack(
  userId: string | null | undefined,
  trackId: string | null | undefined,
): boolean {
  return isBetaSmokeTrackForEnvironment(
    userId,
    trackId,
    __DEV__,
    process.env.EXPO_PUBLIC_BETA_SMOKE,
  );
}

export function betaSmokeExperienceState(
  status: BetaSmokeExperienceState["preferenceNudgeStatus"] = "ineligible",
): BetaSmokeExperienceState {
  const ready = status !== "ineligible";
  return {
    introVersionSeen: 1,
    firstOwnedTrackId: ready ? BETA_SMOKE_TRACK_ID : null,
    firstOwnedTrackReadyAt: ready ? "2026-08-29T00:00:00.000Z" : null,
    preferenceNudgeStatus: status,
    preferenceNudgeTrackId: ready ? BETA_SMOKE_TRACK_ID : null,
  };
}

export function transitionBetaSmokeExperience(
  current: BetaSmokeExperienceState,
  action: ExperienceAction,
): BetaSmokeExperienceState {
  switch (action.action) {
    case "sync_intro":
      return { ...current, introVersionSeen: Math.max(current.introVersionSeen, action.version) };
    case "claim_nudge":
      return current.preferenceNudgeStatus === "eligible" &&
          current.preferenceNudgeTrackId === action.trackId
        ? { ...current, preferenceNudgeStatus: "shown" }
        : current;
    case "dismiss_nudge":
      return current.preferenceNudgeStatus === "shown" &&
          current.preferenceNudgeTrackId === action.trackId
        ? { ...current, preferenceNudgeStatus: "dismissed" }
        : current;
    case "complete_nudge":
      return current.preferenceNudgeStatus === "shown"
        ? { ...current, preferenceNudgeStatus: "completed" }
        : current;
  }
}
