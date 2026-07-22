import { usePlayer } from "@/src/audio/use-player";
import {
  ScreenHeader,
  ScreenScrollView,
  Text,
  TrackCard,
  TrackRowSkeleton,
} from "@/src/components";
import { useFavorites } from "@/src/hooks/use-favorites";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const favoritesQuery = useFavorites();
  const favorites = favoritesQuery.data;
  const favoritesLoading = isInitialQueryLoading(favoritesQuery);
  const { load } = usePlayer();
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const currentId = usePlayerStore((s) => s.currentTrack?.id);

  function play(track: PlayerTrack, index: number) {
    if (!favorites) return;
    setRepeatMode("all");
    load(track, favorites, index);
  }

  return (
    <ScreenScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
    >
      <ScreenHeader
        kicker={t("profile.favorites.kicker")}
        title={t("profile.favorites.title")}
      />

      {favoritesLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((index) => (
            <TrackRowSkeleton key={index} />
          ))}
        </View>
      ) : favorites && favorites.length > 0 ? (
        <View style={styles.list}>
          {favorites.map((track, index) => (
            <TrackCard
              key={track.id}
              variant="row"
              title={track.title}
              artist={track.artist}
              cover={track.album_art_url}
              isPlaying={currentId === track.id}
              onPress={() => play(track, index)}
            />
          ))}
        </View>
      ) : (
        <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6}>
          {t("profile.favorites.empty")}
        </Text>
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
  list: { gap: theme.spacing.stackMd },
}));
