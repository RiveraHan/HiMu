import { usePlayer } from "@/src/audio/use-player";
import { usePlayerStore } from "@/src/stores/player-store";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { MINI_PLAYER_HEIGHT } from "./bottom-chrome-metrics";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export function MiniPlayer() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const router = useRouter();
  const track = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const positionSec = usePlayerStore((state) => state.positionSec);
  const durationSec = usePlayerStore((state) => state.durationSec);
  const { next, prev, toggle } = usePlayer();

  if (!track) return null;

  const pct = durationSec > 0 ? (positionSec / durationSec) * 100 : 0;

  return (
    <View
      accessible={false}
      style={styles.root}
      testID="mini-player"
    >
      <View style={[styles.progress, { width: `${pct}%` }]} />
      <Pressable
        accessibilityLabel={t("common.player.openTrack", {
          title: track.title,
          artist: track.artist,
        })}
        accessibilityRole="button"
        onPress={() => router.push("/player")}
        style={({ pressed }) => [
          styles.metadataControl,
          pressed && styles.pressed,
        ]}
      >
        {track.album_art_url ? (
          <Image
            source={track.album_art_url}
            style={styles.art}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.art, styles.artFallback]} />
        )}
        <View style={styles.meta}>
          <Text variant="bodyMd" numberOfLines={1}>
            {track.title}
          </Text>
          <Text
            variant="bodyMd"
            color="onSurfaceVariant"
            opacity={0.6}
            numberOfLines={1}
          >
            {track.artist}
          </Text>
        </View>
      </Pressable>

      <IconButton
        icon={<SkipBack size={20} color={theme.colors.onSurfaceVariant} />}
        onPress={prev}
        accessibilityLabel={t("common.actions.previous")}
        size="md"
      />

      <IconButton
        icon={
          isPlaying ? (
            <Pause
              size={20}
              color={theme.colors.primary}
              fill={theme.colors.primary}
            />
          ) : (
            <Play
              size={20}
              color={theme.colors.primary}
              fill={theme.colors.primary}
            />
          )
        }
        onPress={toggle}
        accessibilityLabel={
          isPlaying ? t("common.actions.pause") : t("common.actions.play")
        }
        accessibilityState={{ selected: isPlaying }}
        size="md"
      />
      <IconButton
        icon={<SkipForward size={20} color={theme.colors.onSurfaceVariant} />}
        onPress={next}
        accessibilityLabel={t("common.actions.next")}
        size="md"
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    width: "100%",
    minHeight: MINI_PLAYER_HEIGHT,
    paddingHorizontal: theme.spacing.stackSm,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: "rgba(26,28,30,0.92)",
    overflow: "hidden",
  },

  pressed: {
    opacity: 0.7,
  },

  progress: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 2,
    backgroundColor: theme.colors.primary,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
  },
  artFallback: {
    backgroundColor: theme.colors.glassTint,
  },
  metadataControl: {
    minHeight: 44,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  meta: {
    flex: 1,
    justifyContent: "center",
  },
}));
