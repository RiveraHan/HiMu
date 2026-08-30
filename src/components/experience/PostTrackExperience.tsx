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

export type PostTrackExperienceProps = Readonly<{
  trackId: string;
  /** Set only by Player's exact local beta-smoke fixture boundary. */
  isBetaSmokeFixture?: boolean;
}>;

type TrackNudgeState = {
  owner: symbol | null;
  claimAttempted: boolean;
  claimInFlight: boolean;
  shownTracked: boolean;
};

const trackNudgeStates = new Map<string, TrackNudgeState>();
const trackOwnerListeners = new Map<string, Set<() => void>>();

function trackNudgeState(trackId: string): TrackNudgeState {
  const existing = trackNudgeStates.get(trackId);
  if (existing) return existing;

  const created: TrackNudgeState = {
    owner: null,
    claimAttempted: false,
    claimInFlight: false,
    shownTracked: false,
  };
  trackNudgeStates.set(trackId, created);
  return created;
}

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

function clearUnobservedTrackState(trackId: string) {
  if (!trackOwnerListeners.has(trackId)) trackNudgeStates.delete(trackId);
}

function releaseTrackOwner(trackId: string, owner: symbol) {
  const state = trackNudgeState(trackId);
  if (state.owner !== owner) return;
  state.owner = null;
  notifyTrackOwnerChange(trackId);
}

function startTrackClaim(trackId: string): boolean {
  const state = trackNudgeState(trackId);
  if (state.claimAttempted || state.claimInFlight) return false;
  state.claimAttempted = true;
  state.claimInFlight = true;
  notifyTrackOwnerChange(trackId);
  return true;
}

function resetTrackClaim(trackId: string) {
  const state = trackNudgeState(trackId);
  if (!state.claimAttempted && !state.claimInFlight) return;
  state.claimAttempted = false;
  state.claimInFlight = false;
  notifyTrackOwnerChange(trackId);
}

function markTrackShown(trackId: string): boolean {
  const state = trackNudgeState(trackId);
  state.claimInFlight = false;
  if (state.shownTracked) return false;
  state.shownTracked = true;
  notifyTrackOwnerChange(trackId);
  return true;
}

function platform() {
  if (Platform.OS === "web") return "web" as const;
  if (Platform.OS === "android") return "android" as const;
  return "ios" as const;
}

export function PostTrackExperience({
  trackId,
  isBetaSmokeFixture = false,
}: PostTrackExperienceProps) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const state = useExperienceState();
  const claim = useClaimPreferenceNudge();
  const dismiss = useDismissPreferenceNudge();
  const owner = useRef(Symbol("post-track-experience")).current;
  const ownedTrackId = useRef<string | null>(null);
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
    let active = true;
    const unsubscribe = subscribeTrackOwner(trackId, () => {
      if (active) setOwnerVersion((version) => version + 1);
    });
    return () => {
      active = false;
      if (ownedTrackId.current === trackId) {
        releaseTrackOwner(trackId, owner);
        ownedTrackId.current = null;
      }
      unsubscribe();
      clearUnobservedTrackState(trackId);
    };
  }, [owner, trackId]);

  useEffect(() => {
    const participates = eligible || shown;
    if (ownedTrackId.current && ownedTrackId.current !== trackId) {
      releaseTrackOwner(ownedTrackId.current, owner);
      ownedTrackId.current = null;
    }
    if (!participates) {
      if (state.isError) resetTrackClaim(trackId);
      if (ownedTrackId.current) {
        releaseTrackOwner(ownedTrackId.current, owner);
        ownedTrackId.current = null;
      }
      setOwnsTrack(false);
      return;
    }

    const nudgeState = trackNudgeState(trackId);
    if (!nudgeState.owner) {
      nudgeState.owner = owner;
      notifyTrackOwnerChange(trackId);
      ownedTrackId.current = trackId;
      setOwnsTrack(true);
      return;
    }
    setOwnsTrack(nudgeState.owner === owner);
  }, [eligible, owner, ownerVersion, shown, state.isError, trackId]);

  useEffect(() => {
    if (!eligible || !ownsTrack) return;
    if (claim.isError) {
      resetTrackClaim(trackId);
      return;
    }
    if (claim.isPending || !startTrackClaim(trackId)) return;

    claim.mutate(trackId, { onError: () => resetTrackClaim(trackId) });
  }, [claim, eligible, ownsTrack, trackId]);

  useEffect(() => {
    if (!shown || !ownsTrack || !markTrackShown(trackId)) return;

    if (!isBetaSmokeFixture) void trackProductEvent("preference_nudge_shown", analytics);
  }, [analytics, isBetaSmokeFixture, ownsTrack, shown, trackId]);

  if (!shown || !ownsTrack) return null;

  const accept = () => {
    if (!isBetaSmokeFixture) void trackProductEvent("preference_nudge_accepted", analytics);
    router.push("/preferences");
  };
  const dismissNudge = () => {
    dismiss.mutate(trackId);
    if (!isBetaSmokeFixture) void trackProductEvent("preference_nudge_dismissed", analytics);
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
