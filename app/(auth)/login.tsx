import { authApi } from "@/src/api/auth";
import { Button, Text } from "@/src/components";
import { LoginHero } from "@/src/components/auth/LoginHero";
import { GoogleIcon } from "@/src/components/icons";
import { useToast } from "@/src/hooks/use-toast";
import { publicHttpsUrl } from "@/src/utils/public-url";
import { Fragment, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

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

  const legalLinks = [
    {
      label: t("common.auth.terms"),
      url: publicHttpsUrl(process.env.EXPO_PUBLIC_TERMS_URL),
    },
    {
      label: t("common.auth.privacy"),
      url: publicHttpsUrl(process.env.EXPO_PUBLIC_PRIVACY_URL),
    },
  ].filter((item): item is { label: string; url: string } => item.url !== null);

  const openLegal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(t("common.errors.generic"));
    }
  };

  return (
    <LoginHero>
      <View style={styles.methods}>
        <Button
          variant="glass"
          loading={loading}
          leftIcon={<GoogleIcon size={24} />}
          label={t("common.auth.google")}
          loadingLabel={t("common.auth.signingIn")}
          onPress={handleGoogleSignIn}
        />
      </View>

      {legalLinks.length > 0 ? (
        <View style={styles.footer}>
          <View style={styles.legal}>
            {legalLinks.map((item, index) => (
              <Fragment key={item.url}>
                {index > 0 ? (
                  <View testID="legal-separator" style={styles.legalDot} />
                ) : null}
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  onPress={() => void openLegal(item.url)}
                  style={({ pressed }) => [
                    styles.legalLinkTarget,
                    pressed && styles.legalPressed,
                  ]}
                >
                  <Text style={styles.legalLink}>{item.label}</Text>
                </Pressable>
              </Fragment>
            ))}
          </View>
        </View>
      ) : null}
    </LoginHero>
  );
}

const styles = StyleSheet.create((theme) => ({
  methods: {
    gap: theme.spacing.gutter,
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
  legalLinkTarget: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: theme.spacing.stackSm,
    alignItems: "center",
    justifyContent: "center",
  },
  legalPressed: {
    opacity: 0.6,
  },
  legalLink: {
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.1 * 10,
    fontFamily: theme.typography.labelCaps.fontFamily,
    color: theme.colors.onSurface,
    textTransform: "uppercase",
  },
  legalDot: {
    width: 4,
    height: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
}));
