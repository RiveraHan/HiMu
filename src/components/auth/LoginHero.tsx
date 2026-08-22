import type { ReactNode } from "react";
import { Platform, ScrollView, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Atmosphere } from "@/src/components/Atmosphere";
import { GlassCard } from "@/src/components/GlassCard";
import { ScreenCanvas } from "@/src/components/ScreenCanvas";
import { Text } from "@/src/components/Text";
import { useWebCorePresentation } from "@/src/components/web-core-presentation";
import { Logo } from "@/src/components/icons";
import { breakpoints } from "@/src/theme/breakpoints";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  children: ReactNode;
};

export function LoginHero({ children }: Props) {
  useWebCorePresentation("himu-web-core-presentation/login-hero");
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const compactWeb = Platform.OS === "web" && width < breakpoints.xl;
  const signInContent = (
    <>
      <View style={styles.signInIntro}>
        <Text variant="h2">{t("common.auth.desktopSignInTitle")}</Text>
        <Text variant="bodyMd" color="onSurfaceVariant">
          {t("common.auth.desktopSignInExplanation")}
        </Text>
      </View>
      {children}
    </>
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
          <View testID="login-hero-desktop" style={styles.hero}>
            <View testID="login-hero-promise" style={styles.promisePanel}>
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
              <View style={styles.benefitSection}>
                <Text variant="h2">{t("common.auth.desktopTitle")}</Text>
                <View
                  testID="login-benefit-list"
                  accessibilityRole="list"
                  style={styles.benefits}
                >
                  <Text
                    testID="login-benefit"
                    role="listitem"
                    variant="bodyLg"
                    color="onSurfaceVariant"
                  >
                    {t("common.auth.desktopBenefit")}
                  </Text>
                </View>
              </View>
            </View>
            {compactWeb ? (
              <View testID="login-hero-sign-in" style={styles.signInPanel}>
                {signInContent}
              </View>
            ) : (
              <GlassCard testID="login-hero-sign-in" level={2} style={styles.signInPanel}>
                {signInContent}
              </GlassCard>
            )}
          </View>
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
  hero: {
    flex: 1,
    width: "100%",
    maxWidth: { xs: 520, xl: undefined },
    alignSelf: "center",
    flexDirection: { xs: "column", xl: "row" },
    alignItems: "stretch",
    gap: { xs: theme.spacing.stackLg, xl: theme.spacing.stackLg * 2 },
    paddingTop: { xs: theme.spacing.stackLg * 2, xl: theme.spacing.stackLg * 2 },
    paddingBottom: {
      xs: theme.spacing.safeAreaBottom + theme.spacing.stackLg,
      xl: theme.spacing.stackLg * 2,
    },
  },
  promisePanel: {
    flex: { xs: undefined, xl: 5 },
    justifyContent: { xs: "flex-start", xl: "center" },
    gap: theme.spacing.stackLg,
  },
  signInPanel: {
    flex: { xs: undefined, xl: 4 },
    justifyContent: { xs: "flex-start", xl: "center" },
    gap: theme.spacing.stackLg,
    alignSelf: { xs: "stretch", xl: "center" },
    width: "100%",
    maxWidth: { xs: undefined, xl: 460 },
    minHeight: { xs: undefined, xl: 440 },
    padding: { xs: 0, xl: theme.spacing.cardPadding },
    backgroundColor: { xs: "transparent", xl: theme.colors.glassTint },
    borderWidth: { xs: 0, xl: 1 },
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
  benefitSection: {
    display: { xs: "none", xl: "flex" },
    gap: theme.spacing.stackSm,
  },
  benefits: {},
  signInIntro: {
    display: { xs: "none", xl: "flex" },
    gap: theme.spacing.stackSm,
  },
}));
