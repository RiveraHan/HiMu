import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

import { Text } from "@/src/components/Text";
import { GlassCard } from "@/src/components/GlassCard";

export const WELCOME_PAGES = [
  {
    titleKey: "onboarding.welcome.pages.intro.title",
    bodyKey: "onboarding.welcome.pages.intro.body",
  },
  {
    titleKey: "onboarding.welcome.pages.djs.title",
    bodyKey: "onboarding.welcome.pages.djs.body",
  },
] as const;

type Props = {
  page: 0 | 1;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function WelcomeTour({ page, onBack, onContinue, onSkip }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const contentRef = useRef<View>(null);
  const content = WELCOME_PAGES[page];
  const title = t(content.titleKey);
  const body = t(content.bodyKey);
  const pageCount = t("onboarding.welcome.pageCount", {
    page: page + 1,
    count: WELCOME_PAGES.length,
  });
  const announcement = t("onboarding.welcome.accessibility.announcement", {
    title,
    body,
    page: page + 1,
    count: WELCOME_PAGES.length,
  });

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
    } else {
      opacity.value = 0;
      opacity.value = withTiming(1, {
        duration: 180,
        reduceMotion: ReduceMotion.System,
      });
    }
    AccessibilityInfo.announceForAccessibility(announcement);
    const node = findNodeHandle(contentRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [announcement, opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Modal
      animationType="none"
      onRequestClose={onSkip}
      statusBarTranslucent
      transparent
      visible
    >
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
        testID="welcome-surface"
      >
        <Animated.View style={[styles.frame, animatedStyle]}>
          <GlassCard level={3} style={styles.panel} testID="welcome-panel">
            <ScrollView
              contentContainerStyle={styles.copy}
              showsVerticalScrollIndicator
              style={styles.scroll}
              testID="welcome-scroll"
            >
              <View
                accessible
                accessibilityLabel={announcement}
                focusable
                ref={contentRef}
                testID="welcome-content"
              />
              <Text color="primary" variant="labelCaps">{t("onboarding.welcome.eyebrow")}</Text>
              <Text selectable variant="h1">{title}</Text>
              <Text selectable color="onSurfaceVariant" variant="bodyLg">{body}</Text>
              <Text accessibilityLiveRegion="polite" color="onSurfaceVariant" variant="labelCaps">
                {pageCount}
              </Text>
            </ScrollView>
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={page === 0
                  ? t("onboarding.welcome.accessibility.skip")
                  : t("onboarding.welcome.accessibility.back", { page: 1 })}
                accessibilityRole="button"
                onPress={page === 0 ? onSkip : onBack}
                style={styles.secondaryButton}
              >
                <Text variant="labelCaps">
                  {page === 0
                    ? t("onboarding.welcome.actions.skip")
                    : t("onboarding.welcome.actions.back")}
                </Text>
              </Pressable>
              {page === 1 ? (
                <Pressable
                  accessibilityLabel={t("onboarding.welcome.accessibility.skip")}
                  accessibilityRole="button"
                  onPress={onSkip}
                  style={styles.secondaryButton}
                >
                  <Text variant="labelCaps">{t("onboarding.welcome.actions.skip")}</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel={page === 0
                  ? t("onboarding.welcome.accessibility.continue")
                  : t("onboarding.welcome.accessibility.showAround")}
                accessibilityRole="button"
                onPress={onContinue}
                style={styles.primaryButton}
              >
                <Text color="onPrimaryContainer" variant="labelCaps">
                  {page === 0
                    ? t("onboarding.welcome.actions.continue")
                    : t("onboarding.welcome.actions.showAround")}
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  scrim: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  frame: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "100%",
    alignSelf: "center",
  },
  panel: {
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
  actions: { flexDirection: "row", gap: theme.spacing.stackSm },
  secondaryButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
  },
  primaryButton: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: theme.spacing.gutter,
  },
}));
