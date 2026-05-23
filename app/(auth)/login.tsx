import { authApi } from "@/src/api/auth";
import { Atmosphere, GlassCard } from "@/src/components";
import { GoogleIcon, Logo, SpotifyIcon } from "@/src/components/icons";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export default function LoginScreen() {
  const [loading, setLoading] = useState<boolean>(false);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await authApi.signInWithGoogle();
    } catch (error) {
      console.error("[LoginScreen] Google sign-in error:", error);
      Alert.alert(
        "Sign-in failed",
        "We couldn't sign you in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const showComingSoon = () =>
    Alert.alert("Coming soon", "This sign-in method is not available yet.");

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
          <Text style={styles.title}>Welcome to HiMu</Text>
          <Text style={styles.subtitle}>Your sonic journey begins here.</Text>
        </View>

        {/* Methods */}
        <View style={styles.methods}>
          <Pressable
            onPress={showComingSoon}
            disabled={loading}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <GlassCard level={1} style={styles.oauthCard}>
              <SpotifyIcon size={24} />
              <Text style={styles.oauthLabel}>Continue with Spotify</Text>
            </GlassCard>
          </Pressable>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={loading}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <GlassCard level={1} style={styles.oauthCard}>
              <GoogleIcon size={24} />
              <Text style={styles.oauthLabel} numberOfLines={1}>
                {loading ? "Signing in..." : "Continue with Google"}
              </Text>
            </GlassCard>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={showComingSoon}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Sign in with Email</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLine}>
            New to HiMu?{" "}
            <Text onPress={showComingSoon} style={styles.footerLink}>
              Create an account
            </Text>
          </Text>
          <View style={styles.legal}>
            <Text onPress={() => showComingSoon()} style={styles.legalLink}>
              TERMS OF SERVICE
            </Text>
            <View style={styles.legalDot} />
            <Text onPress={() => showComingSoon()} style={styles.legalLink}>
              PRIVACY POLICY
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
  title: {
    ...theme.typography.h1,
    color: theme.colors.onSurface,
    textAlign: "center",
    letterSpacing: -0.05 * 32,
  },
  subtitle: {
    ...theme.typography.bodyLg,
    color: theme.colors.onSurfaceVariant,
    textAlign: "center",
    opacity: 0.7,
  },
  methods: {
    gap: theme.spacing.gutter,
  },
  oauthCard: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.md,
    padding: 0,
  },
  primaryButton: {
    height: 64,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: theme.shadows.primaryButton,
  },
  primaryButtonText: {
    ...theme.typography.labelCaps,
    color: theme.colors.onPrimaryContainer,
  },
  oauthLabel: {
    ...theme.typography.labelCaps,
    color: theme.colors.onSurface,
    flexShrink: 1,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
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
  footerLine: {
    ...theme.typography.bodyMd,
    color: theme.colors.onSurfaceVariant,
    textAlign: "center",
    opacity: 0.6,
  },
  footerLink: {
    color: theme.colors.primary,
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
