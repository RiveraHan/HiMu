import { usePlayer } from "@/src/audio/use-player";
import { usePlayerStore } from "@/src/stores/player-store";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Loader, Square, Volume2 } from "lucide-react-native";
import { Pressable } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// Plays the DJ's spoken caption in its own audio player, isolated from the
// main player. Ducks the music (pauses it) while speaking.
export function CaptionVoiceButton({ audioUrl }: { audioUrl: string }) {
  const { theme } = useUnistyles();
  const voice = useAudioPlayer({ uri: audioUrl });
  const status = useAudioPlayerStatus(voice);
  const { toggle } = usePlayer();

  const speaking = status.playing;

  const onPress = () => {
    if (speaking) {
      voice.pause();
      return;
    }
    // Duck the main music so the voice is clear.
    if (usePlayerStore.getState().isPlaying) toggle();
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
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={speaking ? "Stop the DJ" : "Hear the DJ"}
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
