import { useSyncExternalStore } from "react";

import type { LanguagePreference } from "@/src/i18n/types";
import type { MusicPreferences } from "@/src/types/music-preferences";
import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
  type UserPreferencesPatch,
} from "@/src/types/preferences";

type NudgeStatus = "eligible" | "shown" | "dismissed" | "completed";

const initialPreferences: MusicPreferences = {
  // Intentional legacy-shaped over-limit rows: production must keep every
  // stored choice visible and ordered while still allowing removal.
  genres: ["Ambient", "Drone", "Lo-Fi", "Chillhop", "Downtempo", "Trip-Hop"],
  excludedMoods: ["Focus", "Relax", "Dreamy", "Meditate"],
  atmosphere: "balanced",
};

const MUSIC_KEY = "himu.browser.music-preferences";
const REMOTE_LANGUAGE_KEY = "himu.browser.remote-language";
const LANGUAGE_STATE_KEY = "himu.language.browser-listener";
const NUDGE_KEY = "himu.browser.preference-nudge-status";

function readMusicPreferences(): MusicPreferences {
  try {
    const raw = window.localStorage.getItem(MUSIC_KEY);
    return raw ? (JSON.parse(raw) as MusicPreferences) : initialPreferences;
  } catch {
    return initialPreferences;
  }
}

function readRemoteLanguage(): LanguagePreference {
  const stored = window.localStorage.getItem(REMOTE_LANGUAGE_KEY);
  return stored === "en" || stored === "es" || stored === "system"
    ? stored
    : "system";
}

let preferences = readMusicPreferences();
let nudgeStatus: NudgeStatus = "eligible";
let experienceValue = createExperienceSnapshot();
const preferenceListeners = new Set<() => void>();
const experienceListeners = new Set<() => void>();

function emit(listeners: Set<() => void>) {
  listeners.forEach((listener) => listener());
}

function counters() {
  window.__HIMU_SETTINGS_COUNTERS__ ??= {
    preferenceSaves: 0,
    playerToggles: 0,
    playerPrevious: 0,
    playerNext: 0,
    nudgeDismissals: 0,
    nudgeCompletions: 0,
  };
  return window.__HIMU_SETTINGS_COUNTERS__;
}

function increment(name: string) {
  const values = counters();
  values[name] = (values[name] ?? 0) + 1;
}

export function prepareSettingsBrowserFixture(locale: "en" | "es", reset: boolean) {
  window.localStorage.setItem(REMOTE_LANGUAGE_KEY, locale);
  window.localStorage.setItem(
    LANGUAGE_STATE_KEY,
    JSON.stringify({ preference: locale, pendingSync: false }),
  );
  if (reset) {
    window.localStorage.removeItem(MUSIC_KEY);
    window.localStorage.removeItem(NUDGE_KEY);
  }
  preferences = readMusicPreferences();
  const storedNudge = window.localStorage.getItem(NUDGE_KEY);
  nudgeStatus = storedNudge === "shown"
    || storedNudge === "dismissed"
    || storedNudge === "completed"
    ? storedNudge
    : "eligible";
  experienceValue = createExperienceSnapshot();
  window.__HIMU_SETTINGS_COUNTERS__ = undefined;
}

export function useMusicPreferences() {
  const data = useSyncExternalStore(
    (listener) => {
      preferenceListeners.add(listener);
      return () => preferenceListeners.delete(listener);
    },
    () => preferences,
    () => preferences,
  );

  return {
    data,
    isPending: false,
    fetchStatus: "idle" as const,
    isError: false,
    refetch: async () => undefined,
  };
}

export function useUpdateMusicPreferences() {
  return {
    mutateAsync: async (next: MusicPreferences) => {
      increment("preferenceSaves");
      // Keep the production saving state observable across the runner's 50 ms
      // CDP polling interval instead of making this contract timing-dependent.
      await new Promise((resolve) => setTimeout(resolve, 120));
      preferences = next;
      window.localStorage.setItem(MUSIC_KEY, JSON.stringify(next));
      emit(preferenceListeners);
    },
  };
}

export function useCurrentUser() {
  return { id: "browser-listener", email: "listener@himu.app" };
}

export function useSettings() {
  const data: UserPreferences = {
    ...DEFAULT_PREFERENCES,
    language: readRemoteLanguage(),
  };
  return { data };
}

export function useUpdateSettings() {
  return {
    mutateAsync: async (patch: UserPreferencesPatch) => {
      if (patch.language) {
        window.localStorage.setItem(REMOTE_LANGUAGE_KEY, patch.language);
      }
    },
  };
}

export function useProfile() {
  return {
    data: { subscriptionTier: "premium" },
    isPending: false,
    isError: false,
    fetchStatus: "idle" as const,
    refetch: async () => undefined,
  };
}

export function useOnlineStatus() {
  return true;
}

export function useMiniPlayerPadding() {
  return 0;
}

export function useToast() {
  return { error: () => undefined };
}

export function usePlayer() {
  return {
    flushListeningStats: async () => undefined,
    seek: () => undefined,
    prev: () => increment("playerPrevious"),
    toggle: () => increment("playerToggles"),
    next: () => increment("playerNext"),
  };
}

function createExperienceSnapshot() {
  return {
    data: {
      introVersionSeen: 2,
      firstOwnedTrackId: "track-first",
      firstOwnedTrackReadyAt: "2026-08-25T12:00:00.000Z",
      preferenceNudgeStatus: nudgeStatus,
      preferenceNudgeTrackId: "track-first",
    },
    isLoading: false,
    isError: false,
  };
}

export function useExperienceState() {
  return useSyncExternalStore(
    (listener) => {
      experienceListeners.add(listener);
      return () => experienceListeners.delete(listener);
    },
    () => experienceValue,
    () => experienceValue,
  );
}

export function useClaimPreferenceNudge() {
  return {
    mutateAsync: async () => {
      const applied = nudgeStatus === "eligible";
      if (applied) {
        nudgeStatus = "shown";
        window.localStorage.setItem(NUDGE_KEY, nudgeStatus);
        experienceValue = createExperienceSnapshot();
        emit(experienceListeners);
      }
      return { state: experienceValue.data, applied };
    },
    isPending: false,
    isError: false,
  };
}

export function useDismissPreferenceNudge() {
  return {
    mutate: () => {
      nudgeStatus = "dismissed";
      window.localStorage.setItem(NUDGE_KEY, nudgeStatus);
      experienceValue = createExperienceSnapshot();
      increment("nudgeDismissals");
      emit(experienceListeners);
    },
  };
}

export function useCompletePreferenceNudge() {
  return {
    mutateAsync: async () => {
      nudgeStatus = "completed";
      window.localStorage.setItem(NUDGE_KEY, nudgeStatus);
      experienceValue = createExperienceSnapshot();
      increment("nudgeCompletions");
      emit(experienceListeners);
    },
  };
}

export function setExperienceStatus(status: NudgeStatus) {
  nudgeStatus = status;
  window.localStorage.setItem(NUDGE_KEY, status);
  experienceValue = createExperienceSnapshot();
  emit(experienceListeners);
}

export function useTrackOwnership() {
  return { data: false };
}

export function useRegenerateCover() {
  return { isPending: false, mutate: () => undefined };
}

export function useTrackPrivateDetails() {
  return { data: null };
}

export function useIsFavorited() {
  return { data: false };
}

export function useToggleFavorite() {
  return { mutate: () => undefined };
}

export async function trackProductEvent() {
  return undefined;
}

export function readPersistedPreferences() {
  return preferences;
}

export function readSettingsCounters() {
  return { ...counters() };
}
