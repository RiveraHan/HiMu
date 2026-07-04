import { usePhaseRotation } from "@/src/hooks/use-phase-rotation";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { EqualizerBars } from "../EqualizerBars";
import { GlassCard } from "../GlassCard";
import { Text } from "../Text";

const INSTRUMENTAL_PHASES = [
  "Composing the melody…",
  "Layering synths and textures…",
  "Mixing and mastering…",
  "Painting the cover art…",
] as const;

const VOCAL_PHASES = [
  "Writing the verses…",
  "Recording the vocals…",
  "Mixing the performance…",
  "Painting the cover art…",
] as const;

// Skeleton row shown at the top of the track list while a mix is generating:
// the result will land exactly here.
export function GeneratingTrackCard({ vocal }: { vocal?: boolean }) {
  const phase = usePhaseRotation(
    vocal ? VOCAL_PHASES : INSTRUMENTAL_PHASES,
    6000,
  );

  return (
    <GlassCard style={styles.card}>
      <View style={styles.artStub}>
        <EqualizerBars bars={4} height={18} />
      </View>
      <View style={styles.textCol}>
        <Text variant="bodyMd">New mix on the way</Text>
        <Animated.View
          key={phase}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.8}>
            {phase}
          </Text>
        </Animated.View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackMd,
    padding: theme.spacing.stackMd,
  },
  artStub: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  textCol: {
    flex: 1,
    gap: theme.spacing.stackXs,
  },
}));
