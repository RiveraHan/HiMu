import { usePlayer } from "@/src/audio/use-player";
import { usePlayerStore } from "@/src/stores/player-store";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export function MiniPlayer() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const router = useRouter();
  const track = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const positionSec = usePlayerStore((state) => state.positionSec);
  const durationSec = usePlayerStore((state) => state.durationSec);
  const { next, prev, toggle } = usePlayer();

  if (!track) return null;

  const pct = durationSec > 0 ? (positionSec / durationSec) * 100 : 0;

  const bottom = insets.bottom + 8 + 64 + theme.spacing.stackSm;

  return (
    <Pressable
      onPress={() => router.push("/player")}
      style={({ pressed }) => [
        styles.root,
        { bottom },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.progress, { width: `${pct}%` }]} />
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

      <IconButton
        icon={<SkipBack size={20} color={theme.colors.onSurfaceVariant} />}
        onPress={prev}
        accessibilityLabel="Back"
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
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        size="md"
      />
      <IconButton
        icon={<SkipForward size={20} color={theme.colors.onSurfaceVariant} />}
        onPress={next}
        accessibilityLabel="Next"
        size="md"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    marginHorizontal: "6%",
    height: 64,
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
    transform: [{ scale: 0.98 }],
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
  meta: {
    flex: 1,
    justifyContent: "center",
  },
}));
