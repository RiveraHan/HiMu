import { usePhaseRotation } from "@/src/hooks/use-phase-rotation";
import { Sparkles } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Text } from "../Text";

// Full-screen takeover for the ~10-15s DJ creation: pulsing halo where the
// avatar is being born + rotating phase messages.
export function DjBirthOverlay({ name }: { name: string }) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const phases = useMemo(
    () => [
      t("dj.birth.phases.personality"),
      t("dj.birth.phases.sound"),
      t("dj.birth.phases.portrait"),
      t("dj.birth.phases.almost"),
    ],
    [t],
  );
  const phase = usePhaseRotation(phases, 4000);

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

      <Text variant="h2">{t("dj.birth.loading", { name })}</Text>

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
        {t("dj.birth.duration")}
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
