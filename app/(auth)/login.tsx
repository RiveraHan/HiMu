import { authApi } from "@/src/api/auth";
import { Atmosphere, Button, Text } from "@/src/components";
import { GoogleIcon, Logo, SpotifyIcon } from "@/src/components/icons";
import { useToast } from "@/src/hooks/use-toast";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const toast = useToast();

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await authApi.signInWithGoogle();
    } catch (error) {
      console.error("[LoginScreen] Google sign-in error:", error);
      toast.error(
        t("common.auth.signInFailedTitle"),
        t("common.auth.signInFailedMessage"),
      );
    } finally {
      setLoading(false);
    }
  };

  const showComingSoon = () =>
    toast.info(
      t("common.auth.comingSoonTitle"),
      t("common.auth.comingSoonMessage"),
    );

  return (
    <View style={styles.root}>
      <Atmosphere />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoWrapper}>
            <Logo size={96} />
          </View>
          <Text variant="h1">{t("common.auth.welcome")}</Text>
          <Text variant="bodyLg" color="onSurfaceVariant" opacity={0.7}>
            {t("common.auth.subtitle")}
          </Text>
        </View>

        {/* Methods */}
        <View style={styles.methods}>
          <Button
            variant="glass"
            label={t("common.auth.spotify")}
            loadingLabel={t("common.auth.signingIn")}
            loading={loading}
            leftIcon={<SpotifyIcon size={24} />}
            onPress={showComingSoon}
          />

          <Button
            variant="glass"
            loading={loading}
            leftIcon={<GoogleIcon size={24} />}
            label={t("common.auth.google")}
            loadingLabel={t("common.auth.signingIn")}
            onPress={handleGoogleSignIn}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("common.auth.or")}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            variant="primary"
            onPress={showComingSoon}
            label={t("common.auth.email")}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6}>
            {t("common.auth.accountPrompt")} {" "}
            <Text onPress={showComingSoon} color="primary">
              {t("common.auth.signUp")}
            </Text>
          </Text>
          <View style={styles.legal}>
            <Text onPress={() => showComingSoon()} style={styles.legalLink}>
              {t("common.auth.terms")}
            </Text>
            <View style={styles.legalDot} />
            <Text onPress={() => showComingSoon()} style={styles.legalLink}>
              {t("common.auth.privacy")}
            </Text>
          </View>
        </View>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.pageMargin,
    paddingTop: theme.spacing.stackLg * 2,
    paddingBottom: theme.spacing.safeAreaBottom + theme.spacing.stackLg,
    gap: theme.spacing.stackLg,
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
  methods: {
    gap: theme.spacing.gutter,
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackMd,
    marginVertical: theme.spacing.stackSm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.glassBorder,
  },
  dividerText: {
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.15 * 10,
    fontFamily: "Manrope-SemiBold",
    color: theme.colors.onSurfaceVariant,
    opacity: 0.4,
    textTransform: "uppercase",
  },
  footer: {
    marginTop: "auto",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  legal: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
    marginTop: theme.spacing.stackSm,
  },
  legalLink: {
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.1 * 10,
    fontFamily: "Manrope-SemiBold",
    color: theme.colors.onSurfaceVariant,
    textTransform: "uppercase",
    opacity: 0.3,
  },
  legalDot: {
    width: 4,
    height: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
}));
