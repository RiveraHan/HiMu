import { usePlayer } from "@/src/audio/use-player";
import { IconButton, Text } from "@/src/components";
import { FocusAtmosphere } from "@/src/components/focus/FocusAtmosphere";
import { FocusOrb } from "@/src/components/focus/FocusOrb";
import { useFocusTimer } from "@/src/hooks/use-focus-timer";
import { useFocusTracks } from "@/src/hooks/use-home";
import { useTasteProfile } from "@/src/hooks/use-taste-profile";
import { usePlayerStore, type PlayerTrack } from "@/src/stores/player-store";
import { filterExcluded } from "@/src/utils/weighted-shuffle";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function FocusModeScreen() {
  const { t } = useTranslation();
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
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const { data: focusData } = useFocusTracks();
  const taste = useTasteProfile();

  // Focus queue: calmest first (energy asc, then bpm asc; nulls = neutral mid),
  // with a random tiebreak for session-to-session variety.
  const focusQueue: PlayerTrack[] = useMemo(() => {
    const rows = filterExcluded(
      (focusData ?? []).filter(
        (t): t is typeof t & { audio_url: string } => t.audio_url != null,
      ),
      taste.excludedMoods,
    );
    return rows
      .map((t) => ({ t, r: Math.random() }))
      .sort((a, b) => {
        const e = (a.t.energy_level ?? 5) - (b.t.energy_level ?? 5);
        if (e !== 0) return e;
        const bpm = (a.t.bpm ?? 90) - (b.t.bpm ?? 90);
        if (bpm !== 0) return bpm;
        return a.r - b.r;
      })
      .map(({ t }) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        audio_url: t.audio_url,
        album_art_url: t.album_art_url,
        duration: t.duration,
        genre: t.genre,
      }));
  }, [focusData, taste]);

  // Undo the session loop when leaving focus mode (only if we started it).
  const startedLoop = useRef(false);
  useEffect(
    () => () => {
      if (startedLoop.current) setRepeatMode("off");
    },
    [setRepeatMode],
  );

  // Session ended → stop the looping music too.
  useEffect(() => {
    if (timer.status === "completed" && usePlayerStore.getState().isPlaying) {
      toggleAudio();
    }
  }, [timer.status, toggleAudio]);

  const running = timer.status === "running";
  const canToggle = timer.status !== "idle" || focusQueue.length > 0;
  const label = t(`playback.focus.status.${timer.status}`);

  // One control for the whole session: timer + music start/pause together.
  const onSessionToggle = () => {
    if (process.env.EXPO_OS === "ios") Haptics.selectionAsync();
    switch (timer.status) {
      case "running":
        timer.pause();
        if (isPlaying) toggleAudio();
        break;
      case "paused":
        timer.start(); // resume timer
        if (track && !isPlaying) toggleAudio(); // resume music
        break;
      case "completed":
        timer.reset();
        break;
      default: // idle → fresh session
        if (!focusQueue.length) break;
        timer.start();
        setRepeatMode("all");
        startedLoop.current = true;
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
          <View style={styles.timerBlock}>
            <View style={styles.labelRow}>
              <View style={styles.labelDot} />
              <Text variant="labelCaps" color="primary" style={styles.label}>
                {label}
              </Text>
            </View>
            <Text variant="display" color="onSurface" style={styles.timer}>
              {timer.formatted}
            </Text>
          </View>

          <IconButton
            variant="glass"
            icon={<X size={24} color={theme.colors.onSurfaceVariant} />}
            onPress={() => router.canGoBack() && router.back()}
            accessibilityLabel={t("playback.focus.actions.end")}
          />
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
                  {t("playback.focus.presetMinutes", { minutes: m })}
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
              accessibilityRole="button"
              accessibilityLabel={t("playback.focus.actions.previous")}
            >
              <SkipBack
                size={28}
                color={theme.colors.onSurfaceVariant}
                opacity={track ? 0.6 : 0.25}
              />
            </Pressable>

            <Pressable
              onPress={onSessionToggle}
              disabled={!canToggle}
              accessibilityRole="button"
              accessibilityLabel={
                running
                  ? t("playback.focus.actions.pause")
                  : timer.status === "completed"
                    ? t("playback.focus.actions.reset")
                    : t("playback.focus.actions.start")
              }
              style={[styles.playBtn, !canToggle && styles.playDisabled]}
            >
              {running ? (
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
              accessibilityRole="button"
              accessibilityLabel={t("playback.focus.actions.next")}
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
    marginBottom: theme.spacing.stackLg,
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
