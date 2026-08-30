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
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

export type PostTrackExperienceProps = Readonly<{ trackId: string }>;

const trackOwners = new Map<string, symbol>();
const trackOwnerListeners = new Map<string, Set<() => void>>();

function notifyTrackOwnerChange(trackId: string) {
  trackOwnerListeners.get(trackId)?.forEach((listener) => listener());
}

function subscribeTrackOwner(trackId: string, listener: () => void) {
  const listeners = trackOwnerListeners.get(trackId) ?? new Set<() => void>();
  listeners.add(listener);
  trackOwnerListeners.set(trackId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) trackOwnerListeners.delete(trackId);
  };
}

function releaseTrackOwner(trackId: string, owner: symbol) {
  if (trackOwners.get(trackId) !== owner) return;
  trackOwners.delete(trackId);
  notifyTrackOwnerChange(trackId);
}

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
  const owner = useRef(Symbol("post-track-experience")).current;
  const ownedTrackId = useRef<string | null>(null);
  const attemptedTrackId = useRef<string | null>(null);
  const shownTrackedTrackId = useRef<string | null>(null);
  const [ownsTrack, setOwnsTrack] = useState(false);
  const [ownerVersion, setOwnerVersion] = useState(0);
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
    const unsubscribe = subscribeTrackOwner(trackId, () => {
      setOwnerVersion((version) => version + 1);
    });
    return () => {
      unsubscribe();
      if (ownedTrackId.current === trackId) {
        releaseTrackOwner(trackId, owner);
        ownedTrackId.current = null;
      }
    };
  }, [owner, trackId]);

  useEffect(() => {
    const participates = eligible || shown;
    if (ownedTrackId.current && ownedTrackId.current !== trackId) {
      releaseTrackOwner(ownedTrackId.current, owner);
      ownedTrackId.current = null;
    }
    if (!participates) {
      if (ownedTrackId.current) {
        releaseTrackOwner(ownedTrackId.current, owner);
        ownedTrackId.current = null;
      }
      attemptedTrackId.current = null;
      setOwnsTrack(false);
      return;
    }

    const trackOwner = trackOwners.get(trackId);
    if (!trackOwner) {
      trackOwners.set(trackId, owner);
      notifyTrackOwnerChange(trackId);
      ownedTrackId.current = trackId;
      setOwnsTrack(true);
      return;
    }
    setOwnsTrack(trackOwner === owner);
  }, [eligible, owner, ownerVersion, shown, trackId]);

  useEffect(() => {
    if (!eligible || !ownsTrack) return;
    if (claim.isError) {
      attemptedTrackId.current = null;
      return;
    }
    if (claim.isPending || attemptedTrackId.current === trackId) return;

    attemptedTrackId.current = trackId;
    claim.mutate(trackId);
  }, [claim, eligible, ownsTrack, trackId]);

  useEffect(() => {
    if (!shown || !ownsTrack || shownTrackedTrackId.current === trackId) return;

    shownTrackedTrackId.current = trackId;
    void trackProductEvent("preference_nudge_shown", analytics);
  }, [analytics, ownsTrack, shown, trackId]);

  if (!shown || !ownsTrack) return null;

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
