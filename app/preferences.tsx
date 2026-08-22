import {
  GroupedChipPicker,
  PrefSection,
  ScreenHeader,
  ScreenScrollView,
  SettingsDesktopGrid,
  SettingsDesktopGridItem,
  StateNotice,
  TrackRowSkeleton,
  VibeSlider,
} from "@/src/components";
import { queryKeys } from "@/src/api/queries";
import { useCurrentUser } from "@/src/hooks/use-auth";
import {
  useMusicPreferences,
  useUpdateMusicPreferences,
} from "@/src/hooks/use-music-preferences";
import {
  getOrCreatePreferenceCommitQueue,
  PreferenceCommitQueue,
} from "@/src/hooks/preference-commit-queue";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useToast } from "@/src/hooks/use-toast";
import { catalogGroupLabel, catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import {
  DEFAULT_MUSIC_PREFERENCES,
  GENRE_GROUPS,
  MOOD_GROUPS,
} from "@/src/types/music-preferences";
import { AudioLines, Ban, SlidersHorizontal } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function MusicPreferencesScreen() {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const user = useCurrentUser();
  const online = useOnlineStatus();
  const toast = useToast();
  const queryClient = useQueryClient();
  const preferencesQuery = useMusicPreferences();
  const { data } = preferencesQuery;
  const { mutateAsync: update } = useUpdateMusicPreferences();
  const userId = user?.id ?? null;
  const queryKey = useMemo(
    () => queryKeys.musicPreferences.me(userId),
    [userId],
  );
  const initialBaselineRef = useRef(data ?? DEFAULT_MUSIC_PREFERENCES);

  const commitQueue = useMemo(
    () =>
      getOrCreatePreferenceCommitQueue(queryClient, userId, {
        baseline: initialBaselineRef.current,
        cancel: () => queryClient.cancelQueries({ queryKey }),
        writeOptimistic: (next) => queryClient.setQueryData(queryKey, next),
        persist: update,
        invalidate: () => queryClient.invalidateQueries({ queryKey }),
        onFailure: () =>
          toast.error(
            t("common.errors.saveFailedTitle"),
            t("common.errors.saveRestoredMessage"),
          ),
      }),
    [queryClient, queryKey, t, toast, update, userId],
  );

  useEffect(() => {
    if (data) commitQueue.syncBaseline(data);
  }, [commitQueue, data]);

  const prefs = data ?? DEFAULT_MUSIC_PREFERENCES;
  const ready = !!data;

  const commit = (patch: Parameters<PreferenceCommitQueue["commit"]>[0]) => {
    if (!online) {
      toast.error(t("common.errors.offline"), t("common.errors.reconnect"));
      return;
    }
    commitQueue.commit(patch);
  };

  const toggleGenre = (genre: string) => {
    const has = prefs.genres.includes(genre);
    const desired = !has;
    commit((current) => ({
      ...current,
      genres: desired
        ? current.genres.includes(genre)
          ? current.genres
          : [...current.genres, genre]
        : current.genres.filter((g) => g !== genre),
    }));
  };

  const toggleExcluded = (mood: string) => {
    const has = prefs.excludedMoods.includes(mood);
    const desired = !has;
    commit((current) => ({
      ...current,
      excludedMoods: desired
        ? current.excludedMoods.includes(mood)
          ? current.excludedMoods
          : [...current.excludedMoods, mood]
        : current.excludedMoods.filter((m) => m !== mood),
    }));
  };

  const setVibe =
    (key: "organicElectronic" | "melancholicEuphoric") => (v: number) =>
      commit((current) => ({
        ...current,
        vibeMapping: { ...current.vibeMapping, [key]: v },
      }));

  const offlineWithoutData =
    !online &&
    preferencesQuery.fetchStatus === "paused" &&
    data === undefined;
  const initialLoading =
    preferencesQuery.isPending &&
    preferencesQuery.fetchStatus === "fetching" &&
    data === undefined;
  const blockingError = preferencesQuery.isError && data === undefined;

  return (
    <ScreenScrollView
      testID="preferences-settings-scroll"
      style={styles.root}
      canvasVariant="wide"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
    >
      <ScreenHeader
        kicker={t("dj.preferences.kicker")}
        title={t("dj.preferences.title")}
        subtitle={t("dj.preferences.subtitle")}
      />

      {offlineWithoutData ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void preferencesQuery.refetch()}
        />
      ) : initialLoading ? (
        <View style={styles.loading}>
          {[0, 1, 2].map((index) => (
            <TrackRowSkeleton key={index} />
          ))}
        </View>
      ) : blockingError ? (
        <StateNotice
          kind={online ? "error" : "offline"}
          title={t("common.errors.generic")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void preferencesQuery.refetch()}
        />
      ) : (
        <>
          <SettingsDesktopGrid testID="preferences-settings-grid">
            <SettingsDesktopGridItem testID="preference-genre-zone">
              <PrefSection
                title={t("dj.preferences.genreAffinity")}
                icon={
                  <AudioLines size={20} color={theme.colors.primaryContainer} />
                }
              >
                <GroupedChipPicker
                  groups={GENRE_GROUPS}
                  selected={prefs.genres}
                  onToggle={toggleGenre}
                  getGroupLabel={(value) =>
                    catalogGroupLabel(value, resolvedLanguage)
                  }
                  getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
                  disabled={!ready}
                />
              </PrefSection>
            </SettingsDesktopGridItem>

            <SettingsDesktopGridItem testID="preference-vibe-zone">
              <PrefSection
                title={t("dj.preferences.vibeMapping")}
                icon={
                  <SlidersHorizontal
                    size={20}
                    color={theme.colors.primaryContainer}
                  />
                }
              >
                <VibeSlider
                  leftLabel={t("dj.preferences.organicAcoustic")}
                  rightLabel={t("dj.preferences.syntheticElectronic")}
                  value={prefs.vibeMapping.organicElectronic}
                  disabled={!ready}
                  onCommit={setVibe("organicElectronic")}
                />
                <VibeSlider
                  leftLabel={t("dj.preferences.melancholic")}
                  rightLabel={t("dj.preferences.euphoric")}
                  value={prefs.vibeMapping.melancholicEuphoric}
                  disabled={!ready}
                  onCommit={setVibe("melancholicEuphoric")}
                />
              </PrefSection>
            </SettingsDesktopGridItem>

            <SettingsDesktopGridItem testID="preference-excluded-zone">
              <PrefSection
                title={t("dj.preferences.excludedMoods")}
                subtitle={t("dj.preferences.excludedMoodsSubtitle")}
                icon={<Ban size={20} color={theme.colors.error} />}
              >
                <GroupedChipPicker
                  groups={MOOD_GROUPS}
                  selected={prefs.excludedMoods}
                  onToggle={toggleExcluded}
                  getGroupLabel={(value) =>
                    catalogGroupLabel(value, resolvedLanguage)
                  }
                  getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
                  disabled={!ready}
                />
              </PrefSection>
            </SettingsDesktopGridItem>
          </SettingsDesktopGrid>
          {preferencesQuery.isError || !online ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={
                online
                  ? t("common.errors.generic")
                  : t("common.errors.offline")
              }
              actionLabel={t("common.actions.retry")}
              onAction={() => void preferencesQuery.refetch()}
            />
          ) : null}
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.stackLg,
  },
  loading: { gap: theme.spacing.stackMd },
}));
