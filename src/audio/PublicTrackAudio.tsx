import type { PublicTrackMoment } from "@/src/moment/moment-types";
import { Button } from "@/src/components/Button";
import { Text } from "@/src/components/Text";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";

export function PublicTrackAudio({ track }: { track: PublicTrackMoment }) {
  // expo-audio creates browser audio during the hook call. Render the same
  // inert shell on the server and on the first client pass, then enable it
  // after hydration to keep public sharing routes server-renderable.
  const [audioReady, setAudioReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    setAudioReady(true);
  }, []);

  if (!audioReady) {
    return <View style={styles.root} testID="public-track-audio" />;
  }

  return <PublicTrackAudioPlayer track={track} />;
}

function PublicTrackAudioPlayer({ track }: { track: PublicTrackMoment }) {
  const { t } = useTranslation();
  const player = useAudioPlayer({ uri: track.audioUrl });
  const status = useAudioPlayerStatus(player);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const playbackAttempt = useRef(0);

  const play = () => {
    const attempt = ++playbackAttempt.current;
    setPlaybackFailed(false);
    try {
      // expo-audio types play() as void, while browser-backed players can still
      // return the HTMLMediaElement promise at runtime. Consume that boundary so
      // autoplay, network, and media rejections become a recoverable UI state.
      const result = player.play() as unknown;
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => {
          if (playbackAttempt.current === attempt) setPlaybackFailed(true);
        });
      }
    } catch {
      if (playbackAttempt.current === attempt) setPlaybackFailed(true);
    }
  };

  return (
    <View style={styles.root} testID="public-track-audio">
      {playbackFailed ? (
        <View style={styles.failure}>
          <View
            accessible
            accessibilityLabel={t("playback.publicTrack.playbackError")}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text selectable variant="bodyMd" color="onSurfaceVariant">
              {t("playback.publicTrack.playbackError")}
            </Text>
          </View>
          <Button
            variant="ghost"
            label={t("playback.publicTrack.retryPlayback")}
            onPress={play}
          />
        </View>
      ) : (
        <Button
          label={status.playing
            ? t("playback.player.actions.pause")
            : t("playback.player.actions.play")}
          loading={status.isBuffering}
          loadingLabel={t("playback.publicTrack.buffering")}
          onPress={() => {
            if (status.playing) player.pause();
            else play();
          }}
        />
      )}
    </View>
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null
    && (typeof value === "object" || typeof value === "function")
    && "then" in value
    && typeof value.then === "function"
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    width: "100%",
    minWidth: 0,
  },
  failure: {
    gap: theme.spacing.stackSm,
  },
}));
