import {
  GlassInput,
  ScreenScrollView,
  Text,
  TrackCard,
  TrackRowSkeleton,
} from "@/src/components";
import { AudiusShelf } from "@/src/components/discover/AudiusShelf";
import { usePlayer } from "@/src/audio/use-player";
import { useAudiusSearch, useAudiusTrending } from "@/src/hooks/use-audius";
import { useTabBarPadding } from "@/src/hooks/use-tab-bar-padding";
import { TourTarget, useAppTour } from "@/src/onboarding";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
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
  const qc = useQueryClient();
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
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
      keyboardShouldPersistTaps="handled"
    >
        <View style={styles.header}>
          <Text variant="h1">{t("discover.title")}</Text>
          <Text variant="bodyLg" color="onSurfaceVariant" opacity={0.6}>
            {t("discover.subtitle")}
          </Text>
        </View>

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

        {searching ? (
          <View style={styles.results}>
            {searchLoading ? (
              [0, 1, 2, 3].map((index) => (
                <TrackRowSkeleton key={index} />
              ))
            ) : results && results.length > 0 ? (
              results.map((track, index) => (
                <TrackCard
                  key={track.id}
                  variant="row"
                  title={track.title}
                  artist={track.artist}
                  cover={track.album_art_url}
                  isPlaying={currentId === track.id}
                  onPress={() => playFrom(results, track, index)}
                />
              ))
            ) : (
              <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6}>
                {t("discover.noResults", { query: debounced.trim() })}
              </Text>
            )}
          </View>
        ) : trending.isError ? (
          <View style={styles.results}>
            <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6}>
              {t("discover.unavailable")}
            </Text>
            <Pressable
              onPress={() => qc.invalidateQueries({ queryKey: ["audius"] })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text variant="bodyMd" color="primary">
                {t("discover.retry")}
              </Text>
            </Pressable>
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
  header: { gap: theme.spacing.stackXs },
  results: { gap: theme.spacing.stackMd },
  retry: { alignSelf: "flex-start" },
  attribution: { textAlign: "center", marginTop: theme.spacing.stackMd },
  pressed: { transform: [{ scale: 0.97 }] },
}));
