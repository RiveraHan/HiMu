import { usePlayer } from "@/src/audio/use-player";
import { SeekBar, Text } from "@/src/components";
import { usePlayerStore } from "@/src/stores/player-store";
import { formatTime } from "@/src/utils/format-time";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ChevronDown,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkle,
} from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export default function PlayerScreen() {
  const track = usePlayerStore((state) => state.currentTrack);
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const positionSec = usePlayerStore((state) => state.positionSec);
  const durationSec = usePlayerStore((state) => state.durationSec);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);

  const { seek, prev, toggle, next } = usePlayer();

  useEffect(() => {
    if (!track && router.canDismiss()) router.dismiss();
  }, [track]);

  if (!track) return null;

  const close = () =>
    router.canDismiss() ? router.dismiss() : router.replace("/");

  // Wraps a control with light haptic feedback (no-op on unsupported devices)
  const withHaptic =
    (
      action: () => void,
      style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
    ) =>
    () => {
      Haptics.impactAsync(style);
      action();
    };

  const remaining = Math.max(durationSec - positionSec, 0);

  return (
    <View style={styles.root}>
      {/* Background */}
      {track.album_art_url && (
        <Image
          source={track.album_art_url}
          style={styles.bg}
          blurRadius={80}
          contentFit="cover"
        />
      )}
      <View style={styles.bgOverlay} />
      <LinearGradient
        colors={["transparent", theme.colors.surface]}
        locations={[0, 0.9]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Content */}
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.stackSm,
            paddingBottom: insets.bottom + theme.spacing.stackLg,
          },
        ]}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={close}
            style={({ pressed }) => [
              styles.glassBtn,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Close player"
          >
            <ChevronDown size={24} color={theme.colors.onSurfaceVariant} />
          </Pressable>

          <View style={styles.topCenter}>
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              style={styles.nowPlaying}
            >
              NOW PLAYING
            </Text>
            <Text variant="labelCaps" color="primary" style={styles.subLabel}>
              HIGH-FIDELITY AUDIO
            </Text>
          </View>
          <Pressable
            onPress={() => {
              // TODO: abrir menú de opciones (cola, compartir, ir al artista)
            }}
            style={({ pressed }) => [
              styles.glassBtn,
              pressed && styles.pressed,
            ]}
          >
            <MoreHorizontal size={24} color={theme.colors.onSurface} />
          </Pressable>
        </View>

        {/* Album art */}
        <View style={styles.artWrap}>
          <Image
            source={track.album_art_url}
            style={styles.art}
            contentFit="cover"
            transition={200}
          />
        </View>

        {/* Meta and Controls */}
        <View style={styles.bottom}>
          <View style={styles.meta}>
            <View style={styles.badge}>
              <Sparkle size={14} color={theme.colors.primary} />
              <Text variant="labelCaps" color="primary">
                CURATED BY HIMU AI
              </Text>
            </View>
            <Text variant="h1" numberOfLines={1} style={styles.title}>
              {track.title}
            </Text>
            <Text variant="bodyLg" color="onSurfaceVariant" numberOfLines={1}>
              {track.artist}
            </Text>
          </View>

          <View style={styles.seekBlock}>
            {/* Controls would go here */}
            <SeekBar
              positionSec={positionSec}
              durationSec={durationSec}
              onSeek={seek}
            />
            <View style={styles.times}>
              <Text
                variant="labelCaps"
                style={styles.time}
                color="onSurfaceVariant"
              >
                {formatTime(positionSec)}
              </Text>
              <Text
                variant="labelCaps"
                color="onSurfaceVariant"
                style={styles.time}
              >
                -{formatTime(remaining)}
              </Text>
            </View>
          </View>

          {/*Shuffle*/}
          <View style={styles.controls}>
            <Pressable
              onPress={withHaptic(toggleShuffle)}
              style={styles.ctrlSm}
              accessibilityLabel="Shuffle"
            >
              <Shuffle
                size={24}
                color={
                  shuffle ? theme.colors.primary : theme.colors.onSurfaceVariant
                }
              />
            </Pressable>
            <Pressable
              onPress={withHaptic(prev)}
              style={styles.ctrlMd}
              accessibilityLabel="Previous track"
            >
              <SkipBack
                size={36}
                color={theme.colors.onSurface}
                fill={theme.colors.onSurface}
              />
            </Pressable>
            <Pressable
              onPress={toggle}
              style={({ pressed }) => [
                styles.playBtn,
                pressed && styles.playPressed,
              ]}
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause
                  size={40}
                  color={theme.colors.onPrimaryContainer}
                  fill={theme.colors.onPrimaryContainer}
                />
              ) : (
                <Play
                  size={40}
                  color={theme.colors.onPrimaryContainer}
                  fill={theme.colors.onPrimaryContainer}
                />
              )}
            </Pressable>

            <Pressable
              onPress={next}
              style={styles.ctrlMd}
              accessibilityLabel="Next"
            >
              <SkipForward
                size={36}
                color={theme.colors.onSurface}
                fill={theme.colors.onSurface}
              />
            </Pressable>

            {/*Repeat*/}
            <Pressable
              onPress={cycleRepeat}
              style={styles.ctrlSm}
              accessibilityLabel="Repeat"
            >
              {repeatMode === "one" ? (
                <Repeat1 size={24} color={theme.colors.primary} />
              ) : (
                <Repeat
                  size={24}
                  color={
                    repeatMode === "all"
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.1 }],
    opacity: 0.6,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surface,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.pageMargin,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.glassTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  topCenter: {
    alignItems: "center",
    gap: 2,
  },
  nowPlaying: {
    letterSpacing: 3,
  },
  subLabel: {
    fontSize: 10,
    letterSpacing: 2,
    opacity: 0.9,
  },

  artWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.stackLg,
  },

  art: {
    width: "100%",
    maxWidth: 340,
    aspectRatio: 1,
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,

    ...(process.env.EXPO_OS === "ios"
      ? { boxShadow: "0 30px 60px rgba(0,0,0,0.6)" }
      : { elevation: 16 }),
  },

  bottom: {
    gap: theme.spacing.stackLg,
  },
  meta: {
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackXs,
    paddingHorizontal: theme.spacing.stackMd,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.glassTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  title: {
    textAlign: "center",
    width: "100%",
    paddingHorizontal: theme.spacing.stackMd,
  },

  seekBlock: {
    gap: theme.spacing.stackSm,
  },

  times: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  time: {
    fontVariant: ["tabular-nums"],
  },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.stackXs,
  },
  ctrlSm: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlMd: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryContainer,
    ...(process.env.EXPO_OS === "ios"
      ? { boxShadow: "0 10px 30px rgba(129,140,248,0.3)" }
      : { elevation: 12 }),
  },
  playPressed: { transform: [{ scale: 1.05 }] },
  pressed: {
    opacity: 0.6,
  },
}));
