import { usePhaseRotation } from "@/src/hooks/use-phase-rotation";
import { Sparkles } from "lucide-react-native";
import { useEffect } from "react";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Text } from "../Text";

const PHASES = [
  "Sketching the personality…",
  "Tuning the sound…",
  "Composing the portrait…",
  "Almost there…",
] as const;

// Full-screen takeover for the ~10-15s DJ creation: pulsing halo where the
// avatar is being born + rotating phase messages.
export function DjBirthOverlay({ name }: { name: string }) {
  const { theme } = useUnistyles();
  const phase = usePhaseRotation(PHASES, 4000);

  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.overlay}>
      <Animated.View style={[styles.halo, pulseStyle]}>
        <Sparkles size={40} color={theme.colors.primary} />
      </Animated.View>

      <Text variant="h2">Giving life to {name}…</Text>

      <Animated.View
        key={phase}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
      >
        <Text variant="bodyMd" color="onSurfaceVariant">
          {phase}
        </Text>
      </Animated.View>

      <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.5}>
        THIS TAKES ABOUT 15 SECONDS
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackMd,
    padding: theme.spacing.pageMargin,
    backgroundColor: theme.colors.background,
  },
  halo: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.glassTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.primaryContainer,
    boxShadow: theme.shadows.glow,
    marginBottom: theme.spacing.stackSm,
  },
}));
