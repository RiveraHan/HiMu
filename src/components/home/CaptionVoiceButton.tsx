import { usePlayer } from "@/src/audio/use-player";
import { resolveCaptionPlaybackUrl } from "@/src/audio/private-media";
import { captureAuthScope } from "@/src/api/auth-scope";
import { supabase } from "@/src/api/supabase";
import { useAuthStore } from "@/src/stores/auth-store";
import { usePlayerStore } from "@/src/stores/player-store";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Loader, Square, Volume2 } from "lucide-react-native";
import { Pressable } from "react-native";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

// Plays the DJ's spoken caption in its own audio player, isolated from the
// main player. Ducks the music (pauses it) while speaking.
export function CaptionVoiceButton({
  audioRef,
  jobId,
}: {
  audioRef: string;
  jobId: string;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const voice = useAudioPlayer();
  const status = useAudioPlayerStatus(voice);
  const { toggle } = usePlayer();

  const speaking = status.playing;

  const onPress = async () => {
    if (speaking) {
      voice.pause();
      return;
    }
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    let playbackUrl: string;
    try {
      playbackUrl = await resolveCaptionPlaybackUrl(
        audioRef,
        jobId,
        captureAuthScope(userId),
        supabase.functions,
      );
    } catch {
      return;
    }

    // Duck the main music so the voice is clear.
    if (usePlayerStore.getState().isPlaying) toggle();
    voice.replace({ uri: playbackUrl });
    voice.seekTo(0);
    voice.play();
  };

  const icon = speaking ? (
    <Square
      size={16}
      color={theme.colors.onSurface}
      fill={theme.colors.onSurface}
    />
  ) : status.isBuffering ? (
    <Loader size={16} color={theme.colors.onSurfaceVariant} />
  ) : (
    <Volume2 size={16} color={theme.colors.onSurface} />
  );

  return (
    <Pressable
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityLabel={
        speaking ? t("home.captionVoice.stop") : t("home.captionVoice.hear")
      }
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.glassTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  pressed: { transform: [{ scale: 0.95 }] },
}));
