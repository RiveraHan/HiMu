import { useSyncExternalStore } from "react";

import type { MusicPreferences } from "@/src/types/music-preferences";

const initialPreferences: MusicPreferences = {
  genres: [],
  excludedMoods: [],
  vibeMapping: { organicElectronic: 0.5, melancholicEuphoric: 0.5 },
  aiFrequency: "optimal",
  discoveryDepth: false,
};

let preferences = initialPreferences;
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
      emit();
    },
  };
}

export function useCurrentUser() {
  return { id: "browser-listener", email: "listener@himu.app" };
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
