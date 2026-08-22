import {
  GlassInput,
  ScreenScrollView,
  StateNotice,
  Text,
  TrackCard,
  TrackRowSkeleton,
} from "@/src/components";
import { AudiusShelf } from "@/src/components/discover/AudiusShelf";
import { TrackGrid } from "@/src/components/content/TrackGrid";
import { usePlayer } from "@/src/audio/use-player";
import { useAudiusSearch, useAudiusTrending } from "@/src/hooks/use-audius";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useTabBarPadding } from "@/src/hooks/use-tab-bar-padding";
import { TourTarget, useAppTour } from "@/src/onboarding";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

// Curated Audius genres (exact API strings), chosen for overlap with HiMu's DJs.
const GENRES: { titleKey: string; genre?: string }[] = [
  { titleKey: "trending" },
  { titleKey: "electronic", genre: "Electronic" },
  { titleKey: "house", genre: "House" },
  { titleKey: "techno", genre: "Techno" },
  { titleKey: "loFi", genre: "Lo-Fi" },
  { titleKey: "hipHop", genre: "Hip-Hop/Rap" },
  { titleKey: "ambient", genre: "Ambient" },
  { titleKey: "rnbSoul", genre: "R&B/Soul" },
  { titleKey: "latin", genre: "Latin" },
];

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const paddingBottom = useTabBarPadding();
  const online = useOnlineStatus();
  const { load } = usePlayer();
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const { registerContextTarget } = useAppTour();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  
  const searching = debounced.trim().length >= 2;
  const searchQuery = useAudiusSearch(debounced);
  const results = searchQuery.data;
  const searchLoading = isInitialQueryLoading(searchQuery);
  const searchOfflineWithoutData =
    !online &&
    searchQuery.fetchStatus === "paused" &&
    (results === undefined || searchQuery.isPlaceholderData);
  const showingOnlinePlaceholder =
    online &&
    searchQuery.isPlaceholderData &&
    searchQuery.fetchStatus === "fetching";
  const visibleResults =
    results &&
    results.length > 0 &&
    (!searchQuery.isPlaceholderData || showingOnlinePlaceholder)
      ? results
      : undefined;
  const placeholderNeedsSkeleton =
    showingOnlinePlaceholder && !results?.length;
  const blockingSearchError =
    searchQuery.isError &&
    (searchQuery.isPlaceholderData || !results || results.length === 0);

  // Shares its cache with the first shelf (same query key) — drives the error
  // banner without a second network request.
  const trending = useAudiusTrending();
  const contentLoading = searching
    ? searchLoading
    : isInitialQueryLoading(trending);

  useEffect(
    () =>
      registerContextTarget({
        tipId: "discover.search",
        targetId: "discover.search",
        ready: !contentLoading,
      }),
    [contentLoading, registerContextTarget],
  );

  function playFrom(tracks: PlayerTrack[], track: PlayerTrack, index: number) {
    setRepeatMode("all");
    load(track, tracks, index);
  }

  return (
    <ScreenScrollView
      style={styles.root}
      canvasVariant="max"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
      keyboardShouldPersistTaps="handled"
    >
        <View style={styles.searchHeader} testID="discover-search-header">
          <View style={styles.header}>
            <Text variant="h1">{t("discover.title")}</Text>
            <Text variant="bodyLg" color="onSurfaceVariant" opacity={0.6}>
              {t("discover.subtitle")}
            </Text>
          </View>

          <View style={styles.searchControl}>
            <TourTarget
              id="discover.search"
              borderRadius={theme.borderRadius.md}
            >
              <GlassInput
                placeholder={t("discover.searchPlaceholder")}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </TourTarget>
          </View>
        </View>

        {searching ? (
          <View style={styles.results}>
            {searchOfflineWithoutData ? (
              <StateNotice
                kind="offline"
                title={t("common.errors.offline")}
                message={t("common.errors.reconnect")}
                actionLabel={t("common.actions.retry")}
                onAction={() => void searchQuery.refetch()}
              />
            ) : searchLoading || placeholderNeedsSkeleton ? (
              [0, 1, 2, 3].map((index) => (
                <TrackRowSkeleton key={index} />
              ))
            ) : blockingSearchError ? (
              <StateNotice
                kind={online ? "error" : "offline"}
                title={t("discover.searchUnavailableTitle")}
                message={t("discover.searchUnavailableMessage")}
                actionLabel={t("common.actions.retry")}
                onAction={() => void searchQuery.refetch()}
              />
            ) : visibleResults ? (
              <TrackGrid
                tracks={visibleResults}
                minCardWidth={185}
                renderTrack={(track, index) => (
                  <TrackCard
                    variant="adaptive"
                    title={track.title}
                    artist={track.artist}
                    cover={track.album_art_url}
                    isPlaying={currentId === track.id}
                    accessibilityLabel={t("discover.playTrack", {
                      title: track.title,
                      artist: track.artist,
                    })}
                    onPress={() => playFrom(visibleResults, track, index)}
                  />
                )}
              />
            ) : (
              <StateNotice
                kind="empty"
                title={t("discover.noResults", { query: debounced.trim() })}
              />
            )}
            {results &&
            results.length > 0 &&
            !searchQuery.isPlaceholderData &&
            (!online || searchQuery.isError) ? (
              <StateNotice
                compact
                kind={online ? "error" : "offline"}
                title={
                  online
                    ? t("discover.searchUnavailableTitle")
                    : t("common.errors.offline")
                }
                actionLabel={t("common.actions.retry")}
                onAction={() => void searchQuery.refetch()}
              />
            ) : null}
          </View>
        ) : (
          <>
            {GENRES.map((g) => (
              <AudiusShelf
                key={g.titleKey}
                title={t(`discover.shelves.${g.titleKey}`)}
                genre={g.genre}
                onPlay={playFrom}
              />
            ))}
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              opacity={0.5}
              style={styles.attribution}
            >
              {t("discover.attribution")}
            </Text>
          </>
        )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.stackLg,
  },
  searchHeader: {
    flexDirection: { xs: "column", xl: "row" },
    alignItems: { xs: "stretch", xl: "flex-end" },
    justifyContent: "space-between",
    gap: theme.spacing.stackLg,
  },
  header: { gap: theme.spacing.stackXs },
  searchControl: { flex: 1 },
  results: { gap: theme.spacing.stackMd },
  attribution: { textAlign: "center", marginTop: theme.spacing.stackMd },
}));
