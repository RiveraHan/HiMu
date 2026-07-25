import { usePhaseRotation } from "@/src/hooks/use-phase-rotation";
import { useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { EqualizerBars } from "../EqualizerBars";
import { GlassCard } from "../GlassCard";
import { Text } from "../Text";
import { useTranslation } from "react-i18next";

// Skeleton row shown at the top of the track list while a mix is generating:
// the result will land exactly here.
export function GeneratingTrackCard({ vocal }: { vocal?: boolean }) {
  const { t } = useTranslation();
  const instrumentalPhases = useMemo(
    () => [
      t("dj.generation.phases.melody"),
      t("dj.generation.phases.textures"),
      t("dj.generation.phases.mastering"),
      t("dj.generation.phases.cover"),
    ],
    [t],
  );
  const vocalPhases = useMemo(
    () => [
      t("dj.generation.phases.verses"),
      t("dj.generation.phases.vocals"),
      t("dj.generation.phases.performance"),
      t("dj.generation.phases.cover"),
    ],
    [t],
  );
  const phase = usePhaseRotation(
    vocal ? vocalPhases : instrumentalPhases,
    6000,
  );

  return (
    <GlassCard style={styles.card}>
      <View style={styles.artStub}>
        <EqualizerBars bars={4} height={18} />
      </View>
      <View style={styles.textCol}>
        <Text variant="bodyMd">{t("dj.generation.cardTitle")}</Text>
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
