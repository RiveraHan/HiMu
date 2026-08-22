import { useSyncExternalStore } from "react";

import type { LanguagePreference } from "@/src/i18n/types";
import type { MusicPreferences } from "@/src/types/music-preferences";
import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
  type UserPreferencesPatch,
} from "@/src/types/preferences";

const initialPreferences: MusicPreferences = {
  genres: [],
  excludedMoods: [],
  vibeMapping: { organicElectronic: 0.5, melancholicEuphoric: 0.5 },
  aiFrequency: "optimal",
  discoveryDepth: false,
};

const MUSIC_KEY = "himu.browser.music-preferences";
const REMOTE_LANGUAGE_KEY = "himu.browser.remote-language";
const FAIL_LANGUAGE_ONCE_KEY = "himu.browser.fail-language-once";

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
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function counters() {
  const browserWindow = window as typeof window & {
    __HIMU_SETTINGS_COUNTERS__?: Record<string, number>;
  };
  browserWindow.__HIMU_SETTINGS_COUNTERS__ ??= {
    preferenceSaves: 0,
    flushes: 0,
    signOuts: 0,
    redirects: 0,
    toasts: 0,
    languageSaves: 0,
    languageFailures: 0,
  };
  return browserWindow.__HIMU_SETTINGS_COUNTERS__;
}

function increment(name: string) {
  const values = counters();
  values[name] = (values[name] ?? 0) + 1;
}

export function useMusicPreferences() {
  const data = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
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
      preferences = next;
      window.localStorage.setItem(MUSIC_KEY, JSON.stringify(next));
      emit();
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
      if (!patch.language) return;
      increment("languageSaves");
      if (window.localStorage.getItem(FAIL_LANGUAGE_ONCE_KEY) === "true") {
        window.localStorage.removeItem(FAIL_LANGUAGE_ONCE_KEY);
        increment("languageFailures");
        throw new Error("browser fixture offline once");
      }
      window.localStorage.setItem(REMOTE_LANGUAGE_KEY, patch.language);
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
  return {
    error: () => increment("toasts"),
  };
}

export function usePlayer() {
  return {
    flushListeningStats: async () => increment("flushes"),
  };
}

export function readPersistedPreferences() {
  return preferences;
}

export function readSettingsCounters() {
  return { ...counters() };
}

export function readRemoteLanguagePreference() {
  return readRemoteLanguage();
}
