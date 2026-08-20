import { ScrollView, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
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
        style={styles.scroll}
        contentContainerStyle={styles.list}
      >
        {tracks.map((track, index) => (
          <View key={track.id} testID={`content-shelf-item-${track.id}`} style={styles.tile}>
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
  scroll: {
    marginHorizontal: { xs: -theme.spacing.pageMargin, xl: 0 },
  },
  list: {
    paddingHorizontal: { xs: theme.spacing.pageMargin, xl: 0 },
    flexDirection: "row",
    gap: theme.spacing.gutter,
    flexWrap: { xs: "nowrap", xl: "wrap" },
    width: { xs: undefined, xl: "100%" },
  },
  tile: {
    width: { xs: TILE_WIDTH, xl: undefined },
    flexBasis: { xs: TILE_WIDTH, xl: 180 },
    flexGrow: { xs: 0, xl: 1 },
    minWidth: { xs: undefined, xl: 180 },
    maxWidth: { xs: undefined, xl: 240 },
  },
}));
