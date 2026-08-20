import { ScrollView, useWindowDimensions, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { resolveLayoutMode } from "@/src/theme/layout";
import type { PlayerTrack } from "@/src/stores/player-store";
import { usePlayerStore } from "@/src/stores/player-store";
import { Text } from "../Text";
import { TrackCard } from "../TrackCard";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useTranslation } from "react-i18next";

const TILE_WIDTH = 140;

type Props = {
  title: string;
  subtitle?: string;
  tracks: PlayerTrack[];
  /** Kept for callers; responsive styles now select the visual presentation. */
  presentation?: "scroll" | "grid";
  onPressTrack: (track: PlayerTrack, index: number) => void;
  getTrackAccessibilityLabel?: (track: PlayerTrack) => string;
};

export function ContentShelf({
  title,
  subtitle,
  tracks,
  onPressTrack,
  getTrackAccessibilityLabel,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = resolveLayoutMode(width) === "desktop";
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const userId = useCurrentUser()?.id;
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="h2">{title}</Text>
        {subtitle && (
          <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6}>
            {subtitle}
          </Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="content-shelf-scroll"
        style={styles.scroll(isDesktop)}
        contentContainerStyle={styles.list(isDesktop)}
      >
        {tracks.map((track, index) => (
          <View key={track.id} testID={`content-shelf-item-${track.id}`} style={styles.tile(isDesktop)}>
            <TrackCard
              variant="tile"
              title={track.title}
              artist={track.artist}
              cover={track.album_art_url}
              isPlaying={currentId === track.id}
              accessibilityLabel={getTrackAccessibilityLabel?.(track)}
              isPrivate={track.owner_id === userId && track.is_public === false}
              privateLabel={t("dj.visibility.privateLabel")}
              onPress={() => onPressTrack(track, index)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.spacing.stackMd,
  },
  header: {
    gap: theme.spacing.stackXs,
  },
  scroll: (isDesktop: boolean) => ({
    marginHorizontal: isDesktop ? 0 : -theme.spacing.pageMargin,
  }),
  list: (isDesktop: boolean) => ({
    paddingHorizontal: isDesktop ? 0 : theme.spacing.pageMargin,
    flexDirection: "row",
    gap: theme.spacing.gutter,
    flexWrap: isDesktop ? "wrap" : "nowrap",
    width: isDesktop ? "100%" : undefined,
  }),
  tile: (isDesktop: boolean) => ({
    width: isDesktop ? undefined : TILE_WIDTH,
    flexBasis: isDesktop ? 180 : TILE_WIDTH,
    flexGrow: isDesktop ? 1 : 0,
    minWidth: isDesktop ? 180 : undefined,
    maxWidth: isDesktop ? 240 : undefined,
  }),
}));
