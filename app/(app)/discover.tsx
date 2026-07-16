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
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// Curated Audius genres (exact API strings), chosen for overlap with HiMu's DJs.
const GENRES: { title: string; genre?: string }[] = [
  { title: "Trending on Audius" },
  { title: "Electronic", genre: "Electronic" },
  { title: "House", genre: "House" },
  { title: "Techno", genre: "Techno" },
  { title: "Lo-Fi", genre: "Lo-Fi" },
  { title: "Hip-Hop", genre: "Hip-Hop/Rap" },
  { title: "Ambient", genre: "Ambient" },
  { title: "R&B / Soul", genre: "R&B/Soul" },
  { title: "Latin", genre: "Latin" },
];

export default function DiscoverScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const paddingBottom = useTabBarPadding();
  const qc = useQueryClient();
  const { load } = usePlayer();
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const currentId = usePlayerStore((s) => s.currentTrack?.id);

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
          <Text variant="h1">Discover</Text>
          <Text variant="bodyLg" color="onSurfaceVariant" opacity={0.6}>
            Real music from independent artists
          </Text>
        </View>

        <GlassInput
          placeholder="Search Audius…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

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
                No results on Audius for “{debounced.trim()}”.
              </Text>
            )}
          </View>
        ) : trending.isError ? (
          <View style={styles.results}>
            <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6}>
              Couldn’t reach Audius right now.
            </Text>
            <Pressable
              onPress={() => qc.invalidateQueries({ queryKey: ["audius"] })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text variant="bodyMd" color="primary">
                Retry
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {GENRES.map((g) => (
              <AudiusShelf
                key={g.title}
                title={g.title}
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
              Powered by Audius
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
