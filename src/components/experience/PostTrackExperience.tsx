import { GlassCard } from "@/src/components/GlassCard";
import { Text } from "@/src/components/Text";
import {
  useClaimPreferenceNudge,
  useDismissPreferenceNudge,
  useExperienceState,
} from "@/src/experience/experience-state";
import { trackProductEvent } from "@/src/experience/product-analytics";
import { useLocale } from "@/src/i18n/use-locale";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { router } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

export type PostTrackExperienceProps = Readonly<{ trackId: string }>;

function platform() {
  if (Platform.OS === "web") return "web" as const;
  if (Platform.OS === "android") return "android" as const;
  return "ios" as const;
}

export function PostTrackExperience({ trackId }: PostTrackExperienceProps) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const state = useExperienceState();
  const claim = useClaimPreferenceNudge();
  const dismiss = useDismissPreferenceNudge();
  const attemptedTrackId = useRef<string | null>(null);
  const shownTrackedTrackId = useRef<string | null>(null);
  const eligible = !state.isLoading
    && !state.isError
    && state.data?.preferenceNudgeStatus === "eligible"
    && state.data.preferenceNudgeTrackId === trackId;
  const shown = !state.isLoading
    && !state.isError
    && state.data?.preferenceNudgeStatus === "shown"
    && state.data.preferenceNudgeTrackId === trackId;
  const analytics = useMemo(() => ({
    flowVersion: 1,
    locale: resolvedLanguage,
    platform: platform(),
  } as const), [resolvedLanguage]);

  useEffect(() => {
    if (!eligible) {
      attemptedTrackId.current = null;
      return;
    }
    if (claim.isPending || attemptedTrackId.current === trackId) return;

    attemptedTrackId.current = trackId;
    claim.mutate(trackId);
  }, [claim, eligible, trackId]);

  useEffect(() => {
    if (!shown || shownTrackedTrackId.current === trackId) return;

    shownTrackedTrackId.current = trackId;
    void trackProductEvent("preference_nudge_shown", analytics);
  }, [analytics, shown, trackId]);

  if (!shown) return null;

  const accept = () => {
    void trackProductEvent("preference_nudge_accepted", analytics);
    router.push("/preferences");
  };
  const dismissNudge = () => {
    dismiss.mutate(trackId);
    void trackProductEvent("preference_nudge_dismissed", analytics);
  };

  return (
    <GlassCard level={1} style={styles.card} testID="post-track-preference-nudge">
      <View accessibilityRole="header" accessible accessibilityLabel={t("playback.preferenceNudge.title")}>
        <Text variant="h2">{t("playback.preferenceNudge.title")}</Text>
      </View>
      <Text color="onSurfaceVariant" variant="bodyMd" style={styles.body}>
        {t("playback.preferenceNudge.body")}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={t("playback.preferenceNudge.actions.choose")}
          accessibilityRole="button"
          onPress={accept}
          style={({ pressed }) => [styles.action, styles.primaryAction, pressed && styles.pressed]}
        >
          <Text color="onPrimaryContainer" variant="labelCaps">
            {t("playback.preferenceNudge.actions.choose")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("playback.preferenceNudge.actions.notNow")}
          accessibilityRole="button"
          onPress={dismissNudge}
          style={({ pressed }) => [styles.action, styles.secondaryAction, pressed && styles.pressed]}
        >
          <Text color="onSurface" variant="labelCaps">
            {t("playback.preferenceNudge.actions.notNow")}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    marginTop: theme.spacing.stackLg,
    gap: theme.spacing.stackSm,
  },
  body: {
    maxWidth: 560,
  },
  actions: {
    flexDirection: { xs: "column", sm: "row" },
    gap: theme.spacing.stackSm,
    marginTop: theme.spacing.stackXs,
  },
  action: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.md,
  },
  primaryAction: {
    backgroundColor: theme.colors.primary,
  },
  secondaryAction: {
    borderColor: theme.colors.outline,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.8,
  },
}));
