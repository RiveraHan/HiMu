import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "@/src/components/Text";
import type { TourTooltipRenderProps } from "./engine/SpotlightTourEngine";

export function TourTooltip({
  step,
  currentIndex,
  total,
  onNext,
  onPrevious,
  onSkip,
}: TourTooltipRenderProps) {
  const displayIndex = currentIndex + 1;
  return (
    <View accessibilityViewIsModal style={styles.card} testID="tour-tooltip">
      <View style={styles.copy}>
        <Text color="primary" variant="labelCaps">GUIDED TOUR</Text>
        <Text selectable variant="h2">{step.title.toUpperCase()}</Text>
        <Text selectable color="onSurfaceVariant" variant="bodyMd">{step.description}</Text>
        <Text accessibilityLiveRegion="polite" color="onSurfaceVariant" variant="labelCaps">
          {`Step ${displayIndex} of ${total}`}
        </Text>
        <View accessibilityLabel={`Tour progress, step ${displayIndex} of ${total}`} style={styles.progress}>
          {Array.from({ length: total }, (_, index) => (
            <View key={index} style={[styles.dot, index <= currentIndex && styles.dotActive]} />
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`Back to tour step ${Math.max(1, displayIndex - 1)}`}
          accessibilityRole="button"
          disabled={currentIndex === 0}
          onPress={onPrevious}
          style={[styles.action, currentIndex === 0 && styles.disabled]}
        >
          <Text variant="labelCaps">Back</Text>
        </Pressable>
        <Pressable accessibilityLabel="Skip tour" accessibilityRole="button" onPress={onSkip} style={styles.action}>
          <Text variant="labelCaps">Skip</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={currentIndex === total - 1 ? "Finish tour steps" : `Next to tour step ${displayIndex + 1}`}
          accessibilityRole="button"
          onPress={onNext}
          style={[styles.action, styles.next]}
        >
          <Text color="onPrimaryContainer" variant="labelCaps">Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    width: "100%",
    maxWidth: 340,
    gap: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    padding: theme.spacing.cardPadding,
    backgroundColor: theme.colors.surfaceContainerHigh,
    boxShadow: theme.shadows.modal,
  },
  copy: { gap: theme.spacing.stackSm },
  progress: { minHeight: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 18, height: 3, borderRadius: 2, backgroundColor: theme.colors.outlineVariant },
  dotActive: { backgroundColor: theme.colors.primary },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.stackXs },
  action: {
    minWidth: 54,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    paddingHorizontal: theme.spacing.stackSm,
  },
  next: { flex: 1, backgroundColor: theme.colors.primaryContainer },
  disabled: { opacity: 0.4 },
}));
