import { usePlayer } from "@/src/audio/use-player";
import {
  ScreenHeader,
  ScreenScrollView,
  StateNotice,
  TrackCard,
  TrackRowSkeleton,
} from "@/src/components";
import { useFavorites } from "@/src/hooks/use-favorites";
import { TrackGrid } from "@/src/components/content/TrackGrid";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const favoritesQuery = useFavorites();
  const online = useOnlineStatus();
  const router = useRouter();
  const favorites = favoritesQuery.data;
  const favoritesLoading = isInitialQueryLoading(favoritesQuery);
  const { load } = usePlayer();
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const favoritesOfflineWithoutData =
    !online &&
    favoritesQuery.fetchStatus === "paused" &&
    favorites === undefined;
  const blockingFavoritesError =
    favoritesQuery.isError && (!favorites || favorites.length === 0);

  function play(track: PlayerTrack, index: number) {
    if (!favorites) return;
    setRepeatMode("all");
    load(track, favorites, index);
  }

  return (
    <ScreenScrollView
      style={styles.root}
      canvasVariant="max"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
    >
      <ScreenHeader
        kicker={t("profile.favorites.kicker")}
        title={t("profile.favorites.title")}
      />

      {favoritesOfflineWithoutData ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void favoritesQuery.refetch()}
        />
      ) : favoritesLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((index) => (
            <TrackRowSkeleton key={index} />
          ))}
        </View>
      ) : blockingFavoritesError ? (
        <StateNotice
          kind={online ? "error" : "offline"}
          title={t("profile.favorites.unavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void favoritesQuery.refetch()}
        />
      ) : favorites && favorites.length > 0 ? (
        <>
          <TrackGrid
            tracks={favorites}
            minCardWidth={185}
            renderTrack={(track, index) => (
              <TrackCard
                variant="adaptive"
                title={track.title}
                artist={track.artist}
                cover={track.album_art_url}
                isPlaying={currentId === track.id}
                onPress={() => play(track, index)}
              />
            )}
          />
          {favoritesQuery.isError || !online ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={
                online
                  ? t("profile.favorites.unavailable")
                  : t("common.errors.offline")
              }
              actionLabel={t("common.actions.retry")}
              onAction={() => void favoritesQuery.refetch()}
            />
          ) : null}
        </>
      ) : (
        <StateNotice
          kind="empty"
          title={t("profile.favorites.empty")}
          actionLabel={t("profile.favorites.discoverAction")}
          onAction={() => router.replace("/(app)/discover")}
        />
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
