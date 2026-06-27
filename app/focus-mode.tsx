import { usePlayer } from "@/src/audio/use-player";
import { Text } from "@/src/components";
import { FocusAtmosphere } from "@/src/components/focus/FocusAtmosphere";
import { FocusOrb } from "@/src/components/focus/FocusOrb";
import { useFocusTimer } from "@/src/hooks/use-focus-timer";
import { useRecommendedTracks } from "@/src/hooks/use-home";
import { usePlayerStore, type PlayerTrack } from "@/src/stores/player-store";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export default function FocusModeScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  const timer = useFocusTimer({
    onComplete: () =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  });

  const track = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const { toggle: toggleAudio, next, prev, load } = usePlayer();
  const { data: recommended } = useRecommendedTracks();

  const focusQueue: PlayerTrack[] = (recommended ?? [])
    .filter((t): t is typeof t & { audio_url: string } => t.audio_url != null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      audio_url: t.audio_url,
      album_art_url: t.album_art_url,
      duration: t.duration,
      genre: t.genre,
    }));

  const canPlay = !!track || focusQueue.length > 0;

  const running = timer.status === "running";
  const label =
    timer.status === "running"
      ? "DEEP FOCUS"
      : timer.status === "paused"
        ? "PAUSED"
        : timer.status === "completed"
          ? "COMPLETE"
          : "READY";

  // Start the focus queue if nothing is loaded; otherwise toggle play/pause.
  const onPlayPress = () => {
    if (!track) {
      if (focusQueue.length) load(focusQueue[0], focusQueue, 0);
    } else {
      toggleAudio();
    }
  };

  const onTimerPress = () => {
    if (process.env.EXPO_OS === "ios") Haptics.selectionAsync();
    const starting = timer.status === "idle"; // beginning a fresh session
    timer.toggle();
    // Beginning a session with nothing playing also kicks off the focus queue.
    if (starting && !track && focusQueue.length) {
      load(focusQueue[0], focusQueue, 0);
    }
  };

  return (
    <View style={styles.root}>
      <FocusAtmosphere />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + theme.spacing.stackMd },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onTimerPress} style={styles.timerBlock}>
            <View style={styles.labelRow}>
              <View style={styles.labelDot} />
              <Text variant="labelCaps" color="primary" style={styles.label}>
                {label}
              </Text>
            </View>
            <Text variant="display" color="onSurface" style={styles.timer}>
              {timer.formatted}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.canGoBack() && router.back()}
            accessibilityRole="button"
            accessibilityLabel="End focus session"
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && styles.pressed,
            ]}
          >
            <X size={24} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          
        </View>

        {/* Center */}
        <View style={styles.center}>
          <FocusOrb active={running} />
        </View>

        {/* Idle preset chips */}
        {timer.status === "idle" && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.presets}
          >
            {timer.presets.map((m) => (
              <Pressable
                key={m}
                onPress={() => timer.setPreset(m)}
                style={[styles.chip, timer.minutes === m && styles.chipActive]}
              >
                <Text
                  variant="labelCaps"
                  color={
                    timer.minutes === m
                      ? "onPrimaryContainer"
                      : "onSurfaceVariant"
                  }
                >
                  {m} MIN
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* Footer dock*/}
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + theme.spacing.stackMd },
          ]}
        >
          <View style={styles.dock}>
            <Pressable
              onPress={prev}
              disabled={!track}
              style={styles.sideBtn}
              accessibilityLabel="Previous"
            >
              <SkipBack
                size={28}
                color={theme.colors.onSurfaceVariant}
                opacity={track ? 0.6 : 0.25}
              />
            </Pressable>

            <Pressable
              onPress={onPlayPress}
              disabled={!canPlay}
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
              style={[styles.playBtn, !canPlay && styles.playDisabled]}
            >
              {isPlaying ? (
                <Pause
                  size={32}
                  color={theme.colors.onPrimaryContainer}
                  fill={theme.colors.onPrimaryContainer}
                />
              ) : (
                <Play
                  size={32}
                  color={theme.colors.onPrimaryContainer}
                  fill={theme.colors.onPrimaryContainer}
                />
              )}
            </Pressable>

            <Pressable
              onPress={next}
              disabled={!track}
              style={styles.sideBtn}
              accessibilityLabel="Next"
            >
              <SkipForward
                size={28}
                color={theme.colors.onSurfaceVariant}
                opacity={track ? 0.6 : 0.25}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.pageMargin,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  timerBlock: { gap: theme.spacing.stackXs },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryContainer,
    boxShadow: theme.shadows.glow,
  },
  label: { letterSpacing: 2 },
  timer: { fontVariant: ["tabular-nums"] },
  closeBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(42,41,47,0.3)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  pressed: { opacity: 0.6 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "-5%",
  },
  presets: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
  },
  chip: {
    paddingHorizontal: theme.spacing.stackMd,
    paddingVertical: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassTint,
  },
  chipActive: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: "transparent",
  },
  footer: { alignItems: "center" },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackLg,
    paddingHorizontal: theme.spacing.stackLg,
    paddingVertical: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(14,14,19,0.4)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    boxShadow: theme.shadows.modal,
  },
  sideBtn: { padding: theme.spacing.stackSm },
  playBtn: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryContainer,
    boxShadow: theme.shadows.glow,
  },
  playDisabled: { opacity: 0.4 },
}));
