import { GlassCard } from "@/src/components/GlassCard";
import { Text } from "@/src/components/Text";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

export type PublicIntroStep = 1 | 2 | 3;
export type PublicIntroMode = "first-run" | "replay";

export type PublicProductIntroCallbacks = Readonly<{
  onBack(): void;
  onContinue(): void;
  onCreate(): void | Promise<void>;
  onExistingAccount(): void | Promise<void>;
}>;

type Props = Readonly<{
  step: PublicIntroStep;
  mode: PublicIntroMode;
  callbacks: PublicProductIntroCallbacks;
}>;

const PAGE_KEYS = ["promise", "dj", "result"] as const;

function IntroAction({
  label,
  onPress,
  primary = false,
  testID,
}: Readonly<{
  label: string;
  onPress(): void | Promise<void>;
  primary?: boolean;
  testID?: string;
}>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.primaryAction : styles.secondaryAction,
        pressed && styles.pressedAction,
      ]}
    >
      <Text
        variant="labelCaps"
        color={primary ? "onPrimaryContainer" : "onSurface"}
        style={styles.actionLabel}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PublicProductIntro({ step, mode, callbacks }: Props) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const lowHeight = height < 600;
  const pageKey = PAGE_KEYS[step - 1];
  const title = t(`onboarding.publicIntro.pages.${pageKey}.title`);
  const body = t(`onboarding.publicIntro.pages.${pageKey}.body`);
  const pageCount = t("onboarding.publicIntro.pageCount", {
    page: step,
    count: PAGE_KEYS.length,
  });
  const isFinal = step === PAGE_KEYS.length;

  return (
    <ScrollView
      testID="public-intro-scroll"
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        lowHeight ? styles.contentLowHeight : styles.contentCentered,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
          paddingLeft: Math.max(insets.left, 24),
          paddingRight: Math.max(insets.right, 24),
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View
        testID="public-intro-content"
        style={[
          styles.contentFrame,
          lowHeight ? styles.contentLowHeight : styles.contentCentered,
        ]}
      >
        <GlassCard level={2} style={styles.card} testID="public-intro-card">
          {step > 1 ? (
            <IntroAction
              label={t("onboarding.publicIntro.actions.back")}
              onPress={callbacks.onBack}
            />
          ) : null}

          <Text
            accessibilityLiveRegion="polite"
            style={styles.pageCount}
            variant="labelCaps"
            color="onSurfaceVariant"
          >
            {pageCount}
          </Text>
          <Text accessibilityRole="header" accessibilityLabel={title} variant="h1">
            {title}
          </Text>
          <Text variant="bodyLg" color="onSurfaceVariant" style={styles.body}>
            {body}
          </Text>

          <View style={styles.actions}>
            <IntroAction
              label={t(
                isFinal
                  ? "onboarding.publicIntro.actions.create"
                  : "onboarding.publicIntro.actions.continue",
              )}
              onPress={isFinal ? callbacks.onCreate : callbacks.onContinue}
              primary
              testID="public-intro-primary-action"
            />
            {mode === "first-run" ? (
              <IntroAction
                label={t("onboarding.publicIntro.actions.existing")}
                onPress={callbacks.onExistingAccount}
              />
            ) : null}
          </View>
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
  },
  contentFrame: {
    width: "100%",
    flexGrow: 1,
    alignSelf: "center",
    alignItems: "center",
  },
  contentCentered: {
    justifyContent: "center",
  },
  contentLowHeight: {
    justifyContent: "flex-start",
  },
  card: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    gap: theme.spacing.stackMd,
    padding: { xs: theme.spacing.cardPadding, md: theme.spacing.stackLg },
  },
  pageCount: {
    alignSelf: "flex-start",
  },
  body: {
    maxWidth: 560,
  },
  actions: {
    marginTop: theme.spacing.stackMd,
    gap: theme.spacing.stackSm,
  },
  action: {
    width: "100%",
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.gutter,
    paddingVertical: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
  },
  primaryAction: {
    backgroundColor: theme.colors.primaryContainer,
    boxShadow: theme.shadows.primaryButton,
  },
  secondaryAction: {
    backgroundColor: "transparent",
  },
  pressedAction: {
    transform: [{ scale: 0.98 }],
  },
  actionLabel: {
    textAlign: "center",
    flexShrink: 1,
  },
}));
