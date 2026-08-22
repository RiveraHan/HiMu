import { getEdgeErrorPayload } from "@/src/api/edge-errors";
import { usePlayer } from "@/src/audio/use-player";
import { IconButton, SeekBar, Text } from "@/src/components";
import { PlayerArtwork } from "@/src/components/player/PlayerArtwork";
import {
  PlayerDesktopLayout,
  PlayerDesktopLayoutSlot,
} from "@/src/components/player/PlayerDesktopLayout";
import { useIsFavorited, useToggleFavorite } from "@/src/hooks/use-favorites";
import { useRegenerateCover, useTrackOwnership } from "@/src/hooks/use-home";
import { useTrackPrivateDetails } from "@/src/hooks/use-track-private-details";
import { useToast } from "@/src/hooks/use-toast";
import { usePlayerStore } from "@/src/stores/player-store";
import { formatTime } from "@/src/utils/format-time";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import {
  ChevronDown,
  Heart,
  Loader,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RefreshCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkle,
} from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function PlayerScreen() {
  const { t } = useTranslation();
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
  const ownership = useTrackOwnership(track?.id);
  const privateDetails = useTrackPrivateDetails(
    track?.id,
    ownership.data === true,
  );
  const regenerate = useRegenerateCover();
  const toast = useToast();
  const isFavorited = useIsFavorited(track?.id);
  const toggleFavorite = useToggleFavorite();
  const [artworkController, setArtworkController] = useState<{
    token: symbol | null;
    identity: string;
    displayed: boolean;
  }>({ token: null, identity: "", displayed: false });
  const activateArtworkController = useCallback((token: symbol, identity: string) => {
    setArtworkController({ token, identity, displayed: false });
  }, []);
  const updateArtworkAtmosphere = useCallback((update: {
    token: symbol;
    identity: string;
    displayed: boolean;
  }) => {
    setArtworkController((current) =>
      current.token === update.token
        ? { ...current, identity: update.identity, displayed: update.displayed }
        : current,
    );
  }, []);
  const deactivateArtworkController = useCallback((token: symbol) => {
    setArtworkController((current) =>
      current.token === token
        ? { token: null, identity: "", displayed: false }
        : current,
    );
  }, []);

  useEffect(() => {
    if (!track && router.canDismiss()) router.dismiss();
  }, [track]);

  if (!track) return null;

  // External tracks: Phase A's ephemeral Discover uses the "audius:<id>"
  // client prefix; Phase B's DJ-curated drop materializes a real uuid row
  // instead, so it's detected by its audio_url host. Either way, HiMu neither
  // generated nor curated them, so the badge must say so instead of claiming
  // AI curation.
  const isExternal =
    track.id.startsWith("audius:") || track.audio_url.includes("api.audius.co");

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
  const artworkIdentity = JSON.stringify([track.id, track.album_art_url]);

  return (
    <View style={styles.root}>
      {/* Background */}
      {artworkController.identity === artworkIdentity && artworkController.displayed && track.album_art_url ? (
        <Image
          testID="player-artwork-atmosphere"
          source={track.album_art_url}
          style={styles.bg}
          blurRadius={80}
          contentFit="cover"
        />
      ) : null}
      <View style={styles.bgOverlay} />
      <LinearGradient
        colors={["transparent", theme.colors.surface]}
        locations={[0, 0.9]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Content */}
      <ScrollView
        testID="player-content-scroll"
        style={styles.contentScroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.stackSm,
            paddingBottom: insets.bottom + theme.spacing.stackLg,
          },
        ]}
        showsVerticalScrollIndicator
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <IconButton
            variant="glassStrong"
            icon={
              <ChevronDown size={24} color={theme.colors.onSurfaceVariant} />
            }
            onPress={close}
            accessibilityLabel={t("playback.player.actions.close")}
          />

          <View style={styles.topCenter}>
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              style={styles.nowPlaying}
            >
              {t("playback.player.nowPlaying")}
            </Text>
          </View>

          {/* Balances the close button so the labels stay centered;
              own-DJ tracks get a regenerate-cover action in this slot. */}
          {ownership.data ? (
            <IconButton
              variant="glassStrong"
              disabled={regenerate.isPending}
              icon={
                regenerate.isPending ? (
                  <Loader size={22} color={theme.colors.onSurfaceVariant} />
                ) : (
                  <RefreshCw size={22} color={theme.colors.onSurfaceVariant} />
                )
              }
              onPress={() =>
                regenerate.mutate(
                  {
                    trackId: track.id,
                    title: track.title,
                  },
                  {
                    onError: async (error) => {
                      const payload = await getEdgeErrorPayload(error);
                      toast.error(
                        t("playback.player.cover.title"),
                        payload.code === "daily_quota_reached"
                          ? t("playback.player.cover.quotaError", {
                              limit: payload.dailyLimit ?? 3,
                            })
                          : t("playback.player.cover.error"),
                      );
                    },
                  },
                )
              }
              accessibilityLabel={t("playback.player.actions.regenerateCover")}
            />
          ) : (
            <View style={styles.topSpacer} />
          )}
        </View>

        <PlayerDesktopLayout>
          <PlayerDesktopLayoutSlot slot="artwork">
            <View style={styles.artWrap}>
              <View style={styles.artFrame}>
                <ArtworkAtmosphereController
                  key={artworkIdentity}
                  identity={artworkIdentity}
                  onActivate={activateArtworkController}
                  onAtmosphereChange={updateArtworkAtmosphere}
                  onDeactivate={deactivateArtworkController}
                >
                  {({ onDisplay, onStatusChange }) => (
                    <PlayerArtwork
                      source={track.album_art_url}
                      accessibilityLabel={t("playback.player.artwork.label", {
                        title: track.title,
                      })}
                      onDisplay={onDisplay}
                      onStatusChange={onStatusChange}
                    />
                  )}
                </ArtworkAtmosphereController>
                {/* Floating save action remains attached to the artwork. */}
                <View style={styles.favoriteOverlay}>
                  <IconButton
                    variant="glassStrong"
                    icon={
                      <Heart
                        size={22}
                        color={
                          isFavorited.data
                            ? theme.colors.primary
                            : theme.colors.onSurfaceVariant
                        }
                        fill={
                          isFavorited.data ? theme.colors.primary : "transparent"
                        }
                      />
                    }
                    onPress={() =>
                      toggleFavorite.mutate({
                        track,
                        isFavorited: !!isFavorited.data,
                      })
                    }
                    accessibilityLabel={
                      isFavorited.data
                        ? t("playback.player.actions.removeFavorite")
                        : t("playback.player.actions.saveFavorite")
                    }
                  />
                </View>
              </View>
            </View>
          </PlayerDesktopLayoutSlot>

          <PlayerDesktopLayoutSlot slot="playback">
            <View style={styles.bottom}>
              <View style={styles.meta}>
                <View style={styles.badge}>
                  <Sparkle size={14} color={theme.colors.primary} />
                  <Text variant="labelCaps" color="primary">
                    {isExternal
                      ? t("playback.player.source.audius")
                      : t("playback.player.source.himu")}
                  </Text>
                </View>
                <Text variant="h1" numberOfLines={1} style={styles.title}>
                  {track.title}
                </Text>
                <Text variant="bodyLg" color="onSurfaceVariant" numberOfLines={1}>
                  {track.artist}
                </Text>
                {privateDetails.data ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("playback.player.actions.createVersion")}
                    onPress={() => router.push({
                      pathname: "/create-track",
                      params: {
                        djId: privateDetails.data!.djId,
                        sourceTrackId: privateDetails.data!.trackId,
                      },
                    } as unknown as Href)}
                    style={({ pressed }) => [
                      styles.versionAction,
                      pressed && styles.playPressed,
                    ]}
                  >
                    <Text variant="labelCaps" color="primary">
                      {t("playback.player.actions.createVersion")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.seekBlock}>
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

              <View style={styles.controls}>
                <Pressable
                  onPress={withHaptic(toggleShuffle)}
                  style={styles.ctrlSm}
                  accessibilityRole="button"
                  accessibilityLabel={t("playback.player.actions.shuffle")}
                  accessibilityState={{ checked: shuffle }}
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
                  accessibilityRole="button"
                  accessibilityLabel={t("playback.player.actions.previous")}
                >
                  <SkipBack
                    size={36}
                    color={theme.colors.onSurface}
                    fill={theme.colors.onSurface}
                  />
                </Pressable>
                <Pressable
                  onPress={withHaptic(toggle, Haptics.ImpactFeedbackStyle.Medium)}
                  style={({ pressed }) => [
                    styles.playBtn,
                    pressed && styles.playPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isPlaying
                      ? t("playback.player.actions.pause")
                      : t("playback.player.actions.play")
                  }
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
                  onPress={withHaptic(next)}
                  style={styles.ctrlMd}
                  accessibilityRole="button"
                  accessibilityLabel={t("playback.player.actions.next")}
                >
                  <SkipForward
                    size={36}
                    color={theme.colors.onSurface}
                    fill={theme.colors.onSurface}
                  />
                </Pressable>

                <Pressable
                  onPress={withHaptic(cycleRepeat)}
                  style={styles.ctrlSm}
                  accessibilityRole="button"
                  accessibilityLabel={t("playback.player.actions.repeat")}
                  accessibilityValue={{
                    text: t(`playback.player.repeatModes.${repeatMode}`),
                  }}
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
          </PlayerDesktopLayoutSlot>
        </PlayerDesktopLayout>
      </ScrollView>
    </View>
  );
}

type ArtworkAtmosphereControllerProps = {
  identity: string;
  onActivate: (token: symbol, identity: string) => void;
  onAtmosphereChange: (atmosphere: {
    token: symbol;
    identity: string;
    displayed: boolean;
  }) => void;
  onDeactivate: (token: symbol) => void;
  children: (state: {
    onDisplay: () => void;
    onStatusChange: (status: "idle" | "loading" | "loaded" | "error") => void;
  }) => ReactNode;
};

/** Keyed by a committed, tuple-safe track/source identity at the call site. */
export function ArtworkAtmosphereController({
  identity,
  onActivate,
  onAtmosphereChange,
  onDeactivate,
  children,
}: ArtworkAtmosphereControllerProps) {
  const [displayed, setDisplayed] = useState(false);
  const token = useState(() => Symbol("artwork-controller"))[0];
  const active = useRef(true);

  useLayoutEffect(() => {
    onActivate(token, identity);
    return () => {
      active.current = false;
      onDeactivate(token);
    };
  }, [identity, onActivate, onDeactivate, token]);

  return children({
    onDisplay: () => {
      if (active.current && !displayed) {
        setDisplayed(true);
        onAtmosphereChange({ token, identity, displayed: true });
      }
    },
    onStatusChange: (status) => {
      if (active.current && status !== "loaded" && displayed) {
        setDisplayed(false);
        onAtmosphereChange({ token, identity, displayed: false });
      }
    },
  });
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
  contentScroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.pageMargin,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topSpacer: {
    width: 44,
  },
  topCenter: {
    alignItems: "center",
    gap: 2,
  },
  nowPlaying: {
    letterSpacing: 3,
  },
  artWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.stackLg,
  },

  artFrame: {
    width: "100%",
    maxWidth: { xs: 340, xl: 480, xxl: 560 },
    aspectRatio: 1,
  },

  favoriteOverlay: {
    position: "absolute",
    bottom: theme.spacing.stackMd,
    right: theme.spacing.stackMd,
  },

  bottom: {
    flex: { xs: 0, xl: 1 },
    justifyContent: { xs: "flex-start", xl: "center" },
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
  versionAction: {
    minHeight: 44,
    justifyContent: "center",
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
}));
