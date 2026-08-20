import { Pressable, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const displayIndex = currentIndex + 1;
  return (
    <View accessibilityViewIsModal style={styles.card} testID="tour-tooltip">
      <View style={styles.copy}>
        <Text color="primary" variant="labelCaps">{t("onboarding.tooltip.eyebrow")}</Text>
        <Text selectable variant="h2">{step.title.toUpperCase()}</Text>
        <Text selectable color="onSurfaceVariant" variant="bodyMd">{step.description}</Text>
        <Text accessibilityLiveRegion="polite" color="onSurfaceVariant" variant="labelCaps">
          {t("onboarding.tooltip.stepCount", { step: displayIndex, count: total })}
        </Text>
        <Text color="primary" variant="bodyMd">{t("onboarding.tooltip.interactionHint")}</Text>
        <View
          accessibilityLabel={t("onboarding.tooltip.progress", {
            step: displayIndex,
            count: total,
          })}
          style={styles.progress}
        >
          {Array.from({ length: total }, (_, index) => (
            <View key={index} style={[styles.dot, index <= currentIndex && styles.dotActive]} />
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={t("onboarding.tooltip.accessibility.back", {
            step: Math.max(1, displayIndex - 1),
          })}
          accessibilityRole="button"
          disabled={currentIndex === 0}
          onPress={onPrevious}
          style={[styles.action, currentIndex === 0 && styles.disabled]}
        >
          <Text variant="labelCaps">{t("onboarding.tooltip.actions.back")}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("onboarding.tooltip.accessibility.skip")}
          accessibilityRole="button"
          onPress={onSkip}
          style={styles.action}
        >
          <Text variant="labelCaps">{t("onboarding.tooltip.actions.skip")}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={currentIndex === total - 1
            ? t("onboarding.tooltip.accessibility.finish")
            : t("onboarding.tooltip.accessibility.next", { step: displayIndex + 1 })}
          accessibilityRole="button"
          onPress={onNext}
          style={[styles.action, styles.next]}
        >
          <Text color="onPrimaryContainer" variant="labelCaps">
            {t("onboarding.tooltip.actions.next")}
          </Text>
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
