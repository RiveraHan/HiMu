import { Pressable, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

import { Text } from "@/src/components/Text";

type Props = { onContinue: () => void; onDismiss: () => void };

export function ContinueTourCard({ onContinue, onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text variant="labelCaps" color="primary">{t("onboarding.continueTour.eyebrow")}</Text>
        <Text selectable variant="h2">{t("onboarding.continueTour.title")}</Text>
        <Text selectable color="onSurfaceVariant">{t("onboarding.continueTour.body")}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={t("onboarding.continueTour.accessibility.continue")}
          accessibilityRole="button"
          onPress={onContinue}
          style={styles.button}
        >
          <Text color="onPrimaryContainer" variant="labelCaps">
            {t("onboarding.continueTour.actions.continue")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("onboarding.continueTour.accessibility.dismiss")}
          accessibilityRole="button"
          onPress={onDismiss}
          style={styles.dismissButton}
        >
          <Text color="onSurfaceVariant" variant="labelCaps">
            {t("onboarding.continueTour.actions.end")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    padding: theme.spacing.cardPadding,
    backgroundColor: theme.colors.surfaceContainer,
  },
  copy: { gap: theme.spacing.stackSm },
  actions: { gap: theme.spacing.stackSm },
  button: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    backgroundColor: theme.colors.primaryContainer,
  },
  dismissButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
  },
}));
