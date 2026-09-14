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
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { Platform, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { HiMuMomentCard, type HiMuMomentTrack } from "./HiMuMomentCard";
import { usePlayerStore } from "@/src/stores/player-store";

export type PostTrackExperienceProps = Readonly<{
  trackId: string;
  track?: HiMuMomentTrack;
  /** Set only by Player's exact local beta-smoke fixture boundary. */
  isBetaSmokeFixture?: boolean;
}>;

type TrackNudgeState = {
  owner: symbol | null;
  claimAttempted: boolean;
  claimInFlight: boolean;
  claimWon: boolean;
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
    claimWon: false,
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
  state.claimWon = false;
  notifyTrackOwnerChange(trackId);
}

function settleTrackClaim(trackId: string, applied: boolean) {
  const state = trackNudgeState(trackId);
  state.claimInFlight = false;
  state.claimWon = applied;
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
  track,
  isBetaSmokeFixture = false,
}: PostTrackExperienceProps) {
  const { t } = useTranslation();
  const currentPlayerTrack = usePlayerStore((current) => current.currentTrack);
  const momentTrack = track ?? (currentPlayerTrack && currentPlayerTrack.id === trackId
    ? currentPlayerTrack
    : undefined);
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

    void claim.mutateAsync(trackId).then(
      (outcome) => settleTrackClaim(trackId, outcome.applied),
      () => resetTrackClaim(trackId),
    );
  }, [claim, eligible, ownsTrack, trackId]);

  useEffect(() => {
    const claimWon = trackNudgeState(trackId).claimWon || isBetaSmokeFixture;
    if (!shown || !ownsTrack || !claimWon || !markTrackShown(trackId)) return;

    if (!isBetaSmokeFixture) void trackProductEvent("preference_nudge_shown", analytics);
  }, [analytics, isBetaSmokeFixture, ownsTrack, shown, trackId]);

  const claimWon = trackNudgeState(trackId).claimWon || isBetaSmokeFixture;
  const nudge = shown && ownsTrack && claimWon ? (
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
          <Text color="onPrimaryContainer" variant="labelCaps">{t("playback.preferenceNudge.actions.choose")}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t("playback.preferenceNudge.actions.notNow")}
          accessibilityRole="button"
          onPress={dismissNudge}
          style={({ pressed }) => [styles.action, styles.secondaryAction, pressed && styles.pressed]}
        >
          <Text color="onSurface" variant="labelCaps">{t("playback.preferenceNudge.actions.notNow")}</Text>
        </Pressable>
      </View>
    </GlassCard>
  ) : null;

  return (
    <>
      {nudge}
      {momentTrack ? <MomentBoundary track={momentTrack} trackId={trackId} /> : null}
    </>
  );

  function accept() {
    if (!isBetaSmokeFixture) void trackProductEvent("preference_nudge_accepted", analytics);
    router.push("/preferences");
  };
  function dismissNudge() {
    dismiss.mutate(trackId);
    if (!isBetaSmokeFixture) void trackProductEvent("preference_nudge_dismissed", analytics);
  };

}

function MomentBoundary({ track, trackId }: { track: HiMuMomentTrack; trackId: string }) {
  const queryClient = useContext(QueryClientContext);
  if (!queryClient) return null;
  return <MomentData track={track} trackId={trackId} />;
}

function MomentData({ track, trackId }: { track: HiMuMomentTrack; trackId: string }) {
  // Keep the data hook behind the QueryClient boundary. This also lets the
  // lightweight preference-nudge fixture render without app providers.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTrackMoment } = require("@/src/hooks/use-track-moment") as typeof import("@/src/hooks/use-track-moment");
  const moment = useTrackMoment(trackId);
  if (moment.owner.isLoading || moment.feedback.isLoading || moment.owner.isError || moment.feedback.isError) return null;
  if (!moment.owner.data || !moment.feedback.data) return null;
  return (
    <HiMuMomentCard
      track={track}
      moment={moment.owner.data}
      feedback={moment.feedback.data}
      setVisibility={moment.setVisibility}
      setFeedback={moment.setFeedback}
    />
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
