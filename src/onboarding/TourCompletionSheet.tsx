import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

import { Text } from "@/src/components/Text";
import { GlassCard } from "@/src/components/GlassCard";

type Props = {
  canPlay: boolean;
  onComplete: () => Promise<void>;
  onDismiss?: () => void;
  running?: boolean;
};

export function TourCompletionSheet({
  canPlay,
  onComplete,
  onDismiss,
  running = false,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [localRunning, setLocalRunning] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const contentRef = useRef<View>(null);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(t("onboarding.completion.announcement"));
    const node = findNodeHandle(contentRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [t]);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const handlePress = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setLocalRunning(true);
    try {
      await onComplete();
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setLocalRunning(false);
    }
  };

  const label = canPlay
    ? t("onboarding.completion.actions.playToday")
    : t("onboarding.completion.actions.finish");
  const isRunning = running || localRunning;
  return (
    <Modal animationType="none" onRequestClose={onDismiss} statusBarTranslucent transparent visible>
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        style={[
          styles.scrim,
          {
            paddingTop: insets.top + 16,
            paddingRight: insets.right + 16,
            paddingBottom: insets.bottom + 16,
            paddingLeft: insets.left + 16,
          },
        ]}
        testID="completion-surface"
      >
        <View style={styles.frame}>
          <GlassCard level={3} style={styles.sheet} testID="completion-panel">
            <ScrollView
              contentContainerStyle={styles.copy}
              showsVerticalScrollIndicator
              style={styles.scroll}
              testID="completion-scroll"
            >
              <View
                accessible
                accessibilityLabel={t("onboarding.completion.accessibility")}
                focusable
                ref={contentRef}
                testID="completion-content"
              />
              <Text color="primary" variant="labelCaps">{t("onboarding.completion.eyebrow")}</Text>
              <Text selectable variant="h1">{t("onboarding.completion.title")}</Text>
              <Text selectable color="onSurfaceVariant" variant="bodyLg">
                {t("onboarding.completion.body")}
              </Text>
            </ScrollView>
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ busy: isRunning, disabled: isRunning }}
              disabled={isRunning}
              onPress={() => void handlePress()}
              style={[styles.primaryButton, isRunning && styles.disabled]}
            >
              <Text color="onPrimaryContainer" variant="labelCaps">{label}</Text>
            </Pressable>
          </GlassCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  frame: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "100%",
    alignSelf: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "100%",
    flexShrink: 1,
    gap: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    padding: theme.spacing.cardPadding,
  },
  scroll: { flexShrink: 1 },
  copy: { gap: theme.spacing.stackMd },
  primaryButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: theme.spacing.gutter,
  },
  disabled: { opacity: 0.5 },
}));
