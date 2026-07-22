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

import { Text } from "@/src/components/Text";
import { GlassCard } from "@/src/components/GlassCard";

export const WELCOME_PAGES = [
  {
    title: "YOUR MUSIC, IN THE RIGHT MOMENT",
    body: "HiMu blends AI-created music, curated drops, and listening tools around your mood.",
  },
  {
    title: "MEET YOUR AI DJS",
    body: "Each DJ has a distinct sound and personality. Listen, favorite tracks, and shape what comes next.",
  },
] as const;

type Props = {
  page: 0 | 1;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function WelcomeTour({ page, onBack, onContinue, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const contentRef = useRef<View>(null);
  const content = WELCOME_PAGES[page];

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
    const label = `${content.title}. ${content.body}. Page ${page + 1} of 2`;
    AccessibilityInfo.announceForAccessibility(label);
    const node = findNodeHandle(contentRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [content.body, content.title, opacity, page, reducedMotion]);

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
                accessibilityLabel={`${content.title}. ${content.body}. Page ${page + 1} of 2`}
                focusable
                ref={contentRef}
                testID="welcome-content"
              />
              <Text color="primary" variant="labelCaps">WELCOME TO HIMU</Text>
              <Text selectable variant="h1">{content.title}</Text>
              <Text selectable color="onSurfaceVariant" variant="bodyLg">{content.body}</Text>
              <Text accessibilityLiveRegion="polite" color="onSurfaceVariant" variant="labelCaps">
                {`Page ${page + 1} of 2`}
              </Text>
            </ScrollView>
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={page === 0 ? "Skip introduction" : "Back to introduction page 1"}
                accessibilityRole="button"
                onPress={page === 0 ? onSkip : onBack}
                style={styles.secondaryButton}
              >
                <Text variant="labelCaps">{page === 0 ? "Skip" : "Back"}</Text>
              </Pressable>
              {page === 1 ? (
                <Pressable
                  accessibilityLabel="Skip introduction"
                  accessibilityRole="button"
                  onPress={onSkip}
                  style={styles.secondaryButton}
                >
                  <Text variant="labelCaps">Skip</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel={page === 0 ? "Continue introduction" : "Show me around HiMu"}
                accessibilityRole="button"
                onPress={onContinue}
                style={styles.primaryButton}
              >
                <Text color="onPrimaryContainer" variant="labelCaps">
                  {page === 0 ? "Continue" : "Show me around"}
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
