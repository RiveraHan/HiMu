import type { ReactNode } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Atmosphere } from "@/src/components/Atmosphere";
import { GlassCard } from "@/src/components/GlassCard";
import { ScreenCanvas } from "@/src/components/ScreenCanvas";
import { Text } from "@/src/components/Text";
import { Logo } from "@/src/components/icons";
import { resolveLayoutMode } from "@/src/theme/layout";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  children: ReactNode;
};

export function LoginHero({ children }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = resolveLayoutMode(width) === "desktop";

  const brand = (
    <View style={styles.brand}>
      <View style={styles.logoWrapper}>
        <Logo size={96} />
      </View>
      <Text accessibilityRole="header" variant="h1">
        {t("common.auth.welcome")}
      </Text>
      <Text variant="bodyLg" color="onSurfaceVariant" opacity={0.7}>
        {t("common.auth.subtitle")}
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <Atmosphere />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenCanvas variant="wide" style={styles.canvas}>
          {isDesktop ? (
            <View testID="login-hero-desktop" style={styles.desktop}>
              <View testID="login-hero-promise" style={styles.promisePanel}>
                {brand}
                <View testID="login-benefit-list" accessibilityRole="list" style={styles.benefits}>
                  <Text variant="h2">{t("common.auth.desktopTitle")}</Text>
                  <Text
                    testID="login-benefit"
                    accessibilityRole="text"
                    variant="bodyLg"
                    color="onSurfaceVariant"
                  >
                    {t("common.auth.desktopBenefit")}
                  </Text>
                </View>
              </View>
              <GlassCard testID="login-hero-sign-in" level={2} style={styles.signInPanel}>
                <View style={styles.signInIntro}>
                  <Text variant="h2">{t("common.auth.desktopSignInTitle")}</Text>
                  <Text variant="bodyMd" color="onSurfaceVariant">
                    {t("common.auth.desktopSignInExplanation")}
                  </Text>
                </View>
                {children}
              </GlassCard>
            </View>
          ) : (
            <View testID="login-hero-compact" style={styles.compact}>
              {brand}
              {children}
            </View>
          )}
        </ScreenCanvas>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
  },
  canvas: {
    flexGrow: 1,
  },
  compact: {
    flex: 1,
    paddingTop: theme.spacing.stackLg * 2,
    paddingBottom: theme.spacing.safeAreaBottom + theme.spacing.stackLg,
    gap: theme.spacing.stackLg,
  },
  desktop: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    gap: theme.spacing.stackLg * 2,
    paddingVertical: theme.spacing.stackLg * 2,
  },
  promisePanel: {
    flex: 5,
    justifyContent: "center",
    gap: theme.spacing.stackLg,
  },
  signInPanel: {
    flex: 4,
    justifyContent: "center",
    gap: theme.spacing.stackLg,
    alignSelf: "center",
    width: "100%",
    maxWidth: 460,
    minHeight: 440,
  },
  brand: {
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  logoWrapper: {
    marginBottom: theme.spacing.stackSm,
    alignItems: "center",
    justifyContent: "center",
  },
  benefits: {
    gap: theme.spacing.stackSm,
  },
  signInIntro: {
    gap: theme.spacing.stackSm,
  },
}));
