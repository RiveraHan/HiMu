import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { queryKeys } from "@/src/api/queries";
import { trackProductEvent, useCompletePreferenceNudge } from "@/src/experience";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useMusicPreferences, useUpdateMusicPreferences } from "@/src/hooks/use-music-preferences";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { getOrCreatePreferenceCommitQueue, type PreferencePatch, type PreferenceSaveStatus } from "@/src/hooks/preference-commit-queue";
import { useToast } from "@/src/hooks/use-toast";
import { useLocale } from "@/src/i18n/use-locale";
import { DEFAULT_MUSIC_PREFERENCES, type Atmosphere, type MusicPreferences } from "@/src/types/music-preferences";

const FAVORITE_GENRES_MAX = 5;
const EXCLUDED_MOODS_MAX = 3;

export type PreferenceOperationResult =
  | Readonly<{ accepted: true }>
  | Readonly<{ accepted: false; reason: "offline" | "limit" }>;

function countBucket(count: number): "0" | "1" | "2-3" | "4-5" | "6+" {
  if (count === 0) return "0";
  if (count === 1) return "1";
  if (count <= 3) return "2-3";
  if (count <= 5) return "4-5";
  return "6+";
}

function platform() {
  if (Platform.OS === "web") return "web" as const;
  if (Platform.OS === "android") return "android" as const;
  return "ios" as const;
}

export function useMusicPreferencesController() {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const userId = useCurrentUser()?.id ?? null;
  const online = useOnlineStatus();
  const toast = useToast();
  const queryClient = useQueryClient();
  const preferencesQuery = useMusicPreferences();
  const { mutateAsync: update } = useUpdateMusicPreferences();
  const { mutateAsync: completeNudge } = useCompletePreferenceNudge();
  const [saveStatus, setSaveStatus] = useState<PreferenceSaveStatus>("idle");
  const initialBaseline = useRef<MusicPreferences>(
    preferencesQuery.data ?? DEFAULT_MUSIC_PREFERENCES,
  );
  const currentPrefs = useRef<MusicPreferences>(
    preferencesQuery.data ?? DEFAULT_MUSIC_PREFERENCES,
  );
  const queryKey = useMemo(
    () => queryKeys.musicPreferences.me(userId),
    [userId],
  );

  const queue = useMemo(
    () => getOrCreatePreferenceCommitQueue(queryClient, userId, {
      baseline: initialBaseline.current,
      cancel: () => queryClient.cancelQueries({ queryKey }),
      writeOptimistic: (next) => queryClient.setQueryData(queryKey, next),
      persist: update,
      invalidate: () => queryClient.invalidateQueries({ queryKey }),
      onStatus: (status) => {
        setSaveStatus(status);
        if (status !== "saved") return;

        const snapshot = currentPrefs.current;
        void completeNudge(undefined).catch(() => undefined);
        void trackProductEvent("music_preferences_saved", {
          flowVersion: 1,
          platform: platform(),
          locale: resolvedLanguage,
          selectedCountBucket: countBucket(
            snapshot.genres.length + snapshot.excludedMoods.length,
          ),
        });
      },
      onFailure: () => toast.error(
        t("common.errors.saveFailedTitle"),
        t("common.errors.saveRestoredMessage"),
      ),
    }),
    [completeNudge, queryClient, queryKey, resolvedLanguage, t, toast, update, userId],
  );

  useEffect(() => {
    if (!preferencesQuery.data) return;
    currentPrefs.current = preferencesQuery.data;
    queue.syncBaseline(preferencesQuery.data);
  }, [preferencesQuery.data, queue]);

  const commit = useCallback((patch: PreferencePatch): PreferenceOperationResult => {
    if (!online || !userId) {
      toast.error(t("common.errors.offline"), t("common.errors.reconnect"));
      return { accepted: false, reason: "offline" };
    }
    queue.commit(patch);
    currentPrefs.current = queue.current();
    return { accepted: true };
  }, [online, queue, t, toast, userId]);

  const toggleGenre = useCallback((genre: string): PreferenceOperationResult => {
    const current = queue.current();
    const selected = current.genres.includes(genre);
    if (!selected && current.genres.length >= FAVORITE_GENRES_MAX) {
      return { accepted: false, reason: "limit" };
    }
    return commit((prefs) => ({
      ...prefs,
      genres: selected
        ? prefs.genres.filter((value) => value !== genre)
        : prefs.genres.includes(genre) ? prefs.genres : [...prefs.genres, genre],
    }));
  }, [commit, queue]);

  const setAtmosphere = useCallback((atmosphere: Atmosphere): PreferenceOperationResult => {
    if (queue.current().atmosphere === atmosphere) return { accepted: true };
    return commit((prefs) => ({ ...prefs, atmosphere }));
  }, [commit, queue]);

  const toggleExcludedMood = useCallback((mood: string): PreferenceOperationResult => {
    const current = queue.current();
    const selected = current.excludedMoods.includes(mood);
    if (!selected && current.excludedMoods.length >= EXCLUDED_MOODS_MAX) {
      return { accepted: false, reason: "limit" };
    }
    return commit((prefs) => ({
      ...prefs,
      excludedMoods: selected
        ? prefs.excludedMoods.filter((value) => value !== mood)
        : prefs.excludedMoods.includes(mood)
          ? prefs.excludedMoods
          : [...prefs.excludedMoods, mood],
    }));
  }, [commit, queue]);

  const hasData = preferencesQuery.data !== undefined;
  const offlineWithoutData = !online && !hasData;
  const initialLoading = preferencesQuery.isPending
    && preferencesQuery.fetchStatus === "fetching"
    && !hasData;
  const blockingError = preferencesQuery.isError && !hasData;

  return {
    prefs: preferencesQuery.data ?? DEFAULT_MUSIC_PREFERENCES,
    ready: hasData,
    saveStatus,
    initialLoading,
    offlineWithoutData,
    blockingError,
    showCachedNotice: hasData && (!online || preferencesQuery.isError),
    cachedNoticeKind: !online ? "offline" as const : "error" as const,
    toggleGenre,
    setAtmosphere,
    toggleExcludedMood,
    refetch: preferencesQuery.refetch,
  };
}
