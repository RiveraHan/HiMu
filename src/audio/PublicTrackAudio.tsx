import type { PublicTrackMoment } from "@/src/moment/moment-types";
import { Button } from "@/src/components/Button";
import { Text } from "@/src/components/Text";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

export function PublicTrackAudio({ track }: { track: PublicTrackMoment }) {
  const { t } = useTranslation();
  const player = useAudioPlayer({ uri: track.audioUrl });
  const status = useAudioPlayerStatus(player);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  const play = () => {
    setPlaybackFailed(false);
    try {
      player.play();
    } catch {
      setPlaybackFailed(true);
    }
  };

  return (
    <View style={styles.root} testID="public-track-audio">
      {playbackFailed ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.failure}
        >
          <Text selectable variant="bodyMd" color="onSurfaceVariant">
            {t("playback.publicTrack.playbackError")}
          </Text>
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

const styles = StyleSheet.create((theme) => ({
  root: {
    width: "100%",
    minWidth: 0,
  },
  failure: {
    gap: theme.spacing.stackSm,
  },
}));
