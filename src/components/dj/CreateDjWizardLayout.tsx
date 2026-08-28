import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import * as ReactNative from "react-native";
import { Platform, Pressable, ScrollView, Text as RNText, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ScreenCanvas } from "@/src/components/ScreenCanvas";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Text } from "@/src/components/Text";
import type { CreateDjStep } from "@/src/components/dj/create-dj-wizard-state";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

import { resolveCreateDjLayout } from "./create-dj-layout";

export type CreateDjWizardLayoutProps = Readonly<{
  step: CreateDjStep;
  completedSteps: readonly CreateDjStep[];
  title: string;
  description: string;
  editor: ReactNode;
  summary: ReactNode;
  action: ReactNode;
  onStepPress(step: CreateDjStep): void;
  onBack?(): void;
}>;

const STEP_ORDER: readonly CreateDjStep[] = ["sound", "identity", "review"];

export function CreateDjWizardLayout({
  step,
  completedSteps,
  title,
  description,
  editor,
  summary,
  action,
  onStepPress,
  onBack,
}: CreateDjWizardLayoutProps) {
  const { t } = useTranslation();
  const dimensions = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const progressRef = useRef<RNText>(null);
  const previousStep = useRef(step);
  const availableWidth = measuredWidth ?? dimensions.width;
  const layout = resolveCreateDjLayout({
    width: availableWidth,
    height: dimensions.height,
    fontScale: dimensions.fontScale,
  });
  const wide = layout.mode === "wide";
  const current = STEP_ORDER.indexOf(step) + 1;

  useEffect(() => {
    const changed = previousStep.current !== step;
    previousStep.current = step;
    if (!changed || step === "identity") return;
    const node = ReactNative.findNodeHandle(progressRef.current);
    if (node !== null) ReactNative.AccessibilityInfo.setAccessibilityFocus(node);
  }, [step]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ScreenCanvas
        variant="wide"
        testID="create-dj-wizard-layout"
        nativeID={`create-dj-layout-${layout.mode}`}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          setMeasuredWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
        }}
        style={[
          styles.canvas,
          {
            paddingTop: insets.top + theme.spacing.stackMd,
            paddingBottom,
          },
        ]}
      >
        <ScreenHeader title={title} subtitle={description} onLeftPress={onBack} />

        <View testID="create-dj-wizard-body" style={[styles.body, wide && styles.bodyWide]}>
          <View
            style={[styles.progress, wide && styles.progressWide]}
          >
            <Text
              ref={progressRef}
              accessibilityRole="progressbar"
              accessibilityLabel={t("dj.create.progress", { current, total: STEP_ORDER.length })}
              accessibilityValue={{ min: 1, max: STEP_ORDER.length, now: current }}
              accessibilityLiveRegion="polite"
              variant="labelCaps"
              color="outline"
            >
              {t("dj.create.progress", { current, total: STEP_ORDER.length })}
            </Text>
            <View style={[styles.steps, wide && styles.stepsWide]}>
              {STEP_ORDER.map((candidate, index) => {
                const enabled = candidate === step || completedSteps.includes(candidate);
                const active = candidate === step;
                return (
                  <Pressable
                    key={candidate}
                    accessibilityRole="button"
                    accessibilityLabel={t(`dj.create.steps.${candidate}`)}
                    accessibilityState={{ selected: active, disabled: !enabled }}
                    disabled={!enabled}
                    onPress={() => onStepPress(candidate)}
                    style={({ pressed }) => [
                      styles.step,
                      wide && styles.stepWide,
                      active && styles.stepActive,
                      !enabled && styles.stepDisabled,
                      pressed && styles.stepPressed,
                    ]}
                  >
                    <Text variant="labelCaps" color={active ? "primary" : "onSurfaceVariant"}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <Text variant="bodyMd" color={active ? "onSurface" : "onSurfaceVariant"}>
                      {t(`dj.create.steps.${candidate}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View testID="create-dj-active-editor" style={styles.editor}>
            {editor}
          </View>
          {wide ? (
            <View
              testID="create-dj-wide-summary"
              style={[
                styles.summary,
                Platform.OS === "web" && !layout.lowHeight
                  ? ({ position: "sticky", top: theme.spacing.pageMargin } as never)
                  : undefined,
              ]}
            >
              {summary}
            </View>
          ) : null}
        </View>

        <View testID="create-dj-wizard-action" style={styles.action}>
          {action}
        </View>
      </ScreenCanvas>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { flexGrow: 1 },
  canvas: { gap: theme.spacing.stackLg },
  progress: { gap: theme.spacing.stackSm },
  progressWide: { width: 220, flexShrink: 0 },
  steps: { flexDirection: "row", gap: theme.spacing.stackSm },
  stepsWide: { flexDirection: "column" },
  step: {
    minWidth: 44,
    minHeight: 44,
    flex: 1,
    justifyContent: "center",
    gap: theme.spacing.stackXs,
    paddingHorizontal: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  stepWide: { flex: 0, width: "100%" },
  stepActive: { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary },
  stepDisabled: { opacity: 0.5 },
  stepPressed: { transform: [{ scale: 0.98 }] },
  body: { minWidth: 0, gap: theme.spacing.stackLg },
  bodyWide: { flexDirection: "row", alignItems: "flex-start" },
  editor: { flex: 1, minWidth: 0, gap: theme.spacing.stackLg },
  summary: { width: 300, minWidth: 260, gap: theme.spacing.stackMd },
  action: { width: "100%", minWidth: 0 },
}));
