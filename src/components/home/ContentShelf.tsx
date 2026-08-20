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
        style={styles.scroll}
        contentContainerStyle={styles.list}
      >
        {tracks.map((track, index) => (
          <View key={track.id} style={styles.tile}>
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
    marginHorizontal: -theme.spacing.pageMargin,
  },
  list: {
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.gutter,
  },
  tile: {
    width: TILE_WIDTH,
  },
}));
