import { PublicTrackAudio } from "@/src/audio/PublicTrackAudio";
import { PlayerArtwork } from "@/src/components/player/PlayerArtwork";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ScreenScrollView } from "@/src/components/ScreenScrollView";
import { StateNotice } from "@/src/components/StateNotice";
import { Text } from "@/src/components/Text";
import { usePublicTrack } from "@/src/hooks/use-public-track";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default function PublicTrackScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const parameters = useLocalSearchParams<{ id?: string | string[] }>();
  const trackId = single(parameters.id);
  const query = usePublicTrack(trackId);

  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text selectable variant="bodyMd" color="onSurfaceVariant">
          {t("playback.publicTrack.loading")}
        </Text>
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.centered}>
        <StateNotice
          kind="error"
          title={t("playback.publicTrack.unavailableTitle")}
          message={t("playback.publicTrack.unavailableBody")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void query.refetch()}
        />
      </View>
    );
  }

  const track = query.data;
  return (
    <ScreenScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      canvasVariant="readable"
    >
      <ScreenHeader
        kicker={t("playback.publicTrack.kicker")}
        title={track.title}
        subtitle={track.artist}
        fallbackHref="/welcome"
      />
      <View style={styles.artwork}>
        <PlayerArtwork
          source={track.albumArtUrl}
          accessibilityLabel={t("playback.player.artwork.label", {
            title: track.title,
          })}
        />
      </View>
      {track.genre || track.moods.length > 0 ? (
        <Text selectable variant="bodyMd" color="onSurfaceVariant">
          {[track.genre, ...track.moods].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      <PublicTrackAudio track={track} />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.stackLg,
    paddingTop: theme.spacing.stackLg,
    paddingBottom: theme.spacing.safeAreaBottom,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackMd,
    padding: theme.spacing.pageMargin,
    backgroundColor: theme.colors.background,
  },
  artwork: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
}));
