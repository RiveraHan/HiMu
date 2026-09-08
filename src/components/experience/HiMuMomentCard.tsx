import { useConfirm } from "@/src/hooks/use-confirm";
import { useToast } from "@/src/hooks/use-toast";
import { trackProductEvent } from "@/src/experience/product-analytics";
import { publicTrackMomentUrl } from "@/src/moment/share-origin";
import { shareTrackMoment } from "@/src/moment/share-track";
import type {
  OwnerTrackMoment,
  TrackMomentFeedback,
  TrackMomentFeedbackPatch,
  TrackMomentShareContent,
  TrackMomentVisibility,
} from "@/src/moment/moment-types";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { Share, Platform, Pressable, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Globe2, LockKeyhole } from "lucide-react-native";
import { GlassCard } from "../GlassCard";
import { Text } from "../Text";
import { Button } from "../Button";

export type HiMuMomentTrack = Readonly<{
  id: string;
  title: string;
  artist: string;
  album_art_url: string | null;
}>;

type VisibilityMutation = Readonly<{
  isPending: boolean;
  isError: boolean;
  mutateAsync(input: { trackId: string; visibility: TrackMomentVisibility }): Promise<OwnerTrackMoment>;
}>;

type FeedbackMutation = Readonly<{
  isPending: boolean;
  isError: boolean;
  mutateAsync(input: TrackMomentFeedbackPatch): Promise<TrackMomentFeedback>;
}>;

export type HiMuMomentCardProps = Readonly<{
  track: HiMuMomentTrack;
  moment: OwnerTrackMoment;
  feedback: TrackMomentFeedback;
  setVisibility: VisibilityMutation;
  setFeedback: FeedbackMutation;
}>;

function nativeShare(content: TrackMomentShareContent) {
  return async () => {
    const result = await Share.share({
      title: content.title,
      message: [content.message, content.url].filter(Boolean).join("\n"),
      url: content.url,
    });
    return result.action === Share.sharedAction ? "shared" as const : "cancelled" as const;
  };
}

function browserDependencies() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return {};
  }
  const browser = window.navigator;
  return {
    isSecureContext: window.isSecureContext,
    webShare: typeof browser.share === "function"
      ? (content: TrackMomentShareContent) => browser.share({
        title: content.title,
        text: content.message,
        url: content.url,
      })
      : undefined,
    copy: typeof browser.clipboard?.writeText === "function"
      ? (url: string) => browser.clipboard.writeText(url)
      : undefined,
  };
}

function Choice({
  label,
  selected,
  disabled,
  onPress,
}: Readonly<{ label: string; selected: boolean; disabled: boolean; onPress(): void }>) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected, disabled && styles.disabled]}
    >
      <Text variant="labelCaps" color={selected ? "onPrimaryContainer" : "onSurfaceVariant"}>
        {label}
      </Text>
    </Pressable>
  );
}

export function HiMuMomentCard({ track, moment, feedback, setVisibility, setFeedback }: HiMuMomentCardProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const confirm = useConfirm();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [visibility, setVisibilityState] = useState(moment.visibility);
  const [audioUrl, setAudioUrl] = useState(moment.audioUrl);
  const [surprised, setSurprised] = useState<boolean | null>(feedback.surprised);
  const [wouldShare, setWouldShare] = useState<boolean | null>(feedback.wouldShare);
  const [shareError, setShareError] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState<"surprised" | "wouldShare" | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    setVisibilityState(moment.visibility);
    setAudioUrl(moment.audioUrl);
  }, [moment.audioUrl, moment.visibility]);
  useEffect(() => {
    setSurprised(feedback.surprised);
    setWouldShare(feedback.wouldShare);
  }, [feedback.surprised, feedback.wouldShare]);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    // Track id is opaque and the event allowlist rejects creative metadata.
    void trackProductEvent("moment_shown", { trackId: track.id, visibility });
  }, [track.id, visibility]);

  const shareUrl = publicTrackMomentUrl(process.env.EXPO_PUBLIC_SHARE_ORIGIN, track.id);
  const content: TrackMomentShareContent | null = shareUrl
    ? {
      url: shareUrl,
      title: track.title,
      message: t("playback.moment.shareMessage"),
    }
    : null;

  const changeVisibility = async (next: TrackMomentVisibility) => {
    const ok = await confirm(next === "public"
      ? {
        title: t("playback.moment.confirmPublishTitle"),
        message: t("playback.moment.confirmPublishBody"),
        confirmLabel: t("playback.moment.confirmPublishAction"),
      }
      : {
        title: t("playback.moment.confirmUnpublishTitle"),
        message: t("playback.moment.confirmUnpublishBody"),
        confirmLabel: t("playback.moment.confirmUnpublishAction"),
        destructive: true,
      });
    if (!ok) return;
    try {
      const result = await setVisibility.mutateAsync({ trackId: track.id, visibility: next });
      setVisibilityState(result.visibility);
      setAudioUrl(result.audioUrl);
      void trackProductEvent("moment_visibility_completed", { trackId: track.id, visibility: next, elapsedMs: 0 });
      if (next === "public" && content) await share();
    } catch {
      void trackProductEvent("moment_visibility_failed", { trackId: track.id, visibility: visibility, errorCategory: "network" });
      toast.error(t("playback.moment.title"), t("playback.moment.visibilityError"));
    }
  };

  const share = async () => {
    if (!content || shareBusy) {
      if (!content) toast.warning(t("playback.moment.title"), t("playback.moment.shareUnavailable"));
      return;
    }
    setShareBusy(true);
    setShareError(false);
    try {
      const deps = Platform.OS === "android"
        ? { platform: "android" as const, nativeShare: nativeShare(content) }
        : { platform: "web" as const, ...browserDependencies() };
      const result = await shareTrackMoment(content, deps);
      void trackProductEvent("moment_share_outcome", { trackId: track.id, shareMethod: result.outcome === "copied" ? "clipboard" : "native_share", outcome: result.outcome });
      if (result.outcome === "copied" || result.outcome === "shared") {
        toast.info(t("playback.moment.title"), t("playback.moment.shareSuccess"));
      } else if (result.outcome !== "cancelled") {
        setShareError(true);
      }
    } finally {
      setShareBusy(false);
    }
  };

  const answer = async (question: "surprised" | "wouldShare", value: boolean) => {
    setFeedbackError(null);
    if (question === "surprised") setSurprised(value);
    else setWouldShare(value);
    try {
      await setFeedback.mutateAsync(question === "surprised"
        ? { trackId: track.id, surprised: value }
        : { trackId: track.id, wouldShare: value });
      void trackProductEvent("moment_feedback_answered", { trackId: track.id, question: question === "wouldShare" ? "would_share" : question, answer: value });
    } catch {
      setFeedbackError(question);
    }
  };

  return (
    <GlassCard level={1} style={styles.card} testID="himu-moment-card">
      <View style={styles.headingRow}>
        <View style={styles.heading}>
          <Text variant="labelCaps" color="primary">{t("playback.moment.kicker")}</Text>
          <Text accessibilityRole="header" variant="h2">{t("playback.moment.title")}</Text>
          <View style={styles.identityRow}>
            {track.album_art_url ? (
              <Image
                source={track.album_art_url}
                accessibilityLabel={t("playback.player.artwork.label", { title: track.title })}
                contentFit="cover"
                style={styles.artwork}
              />
            ) : null}
            <View style={styles.identityCopy}>
              <Text color="onSurface" variant="bodyMd">{track.title}</Text>
              <Text color="onSurfaceVariant" variant="bodyMd">{track.artist}</Text>
            </View>
          </View>
        </View>
        <Pressable
          testID="moment-collapse"
          accessibilityRole="button"
          accessibilityLabel={collapsed ? t("playback.moment.expand") : t("playback.moment.collapse")}
          onPress={() => setCollapsed((current) => !current)}
          style={styles.iconAction}
        >
          <Text variant="labelCaps" color="onSurfaceVariant">{collapsed ? "+" : "−"}</Text>
        </Pressable>
      </View>
      {collapsed ? null : (
        <>
          <View style={styles.status} accessibilityLiveRegion="polite">
            {visibility === "public"
              ? <Globe2 size={18} color={theme.colors.primary} accessibilityLabel={t("playback.moment.publicStatus")} />
              : <LockKeyhole size={18} color={theme.colors.onSurfaceVariant} accessibilityLabel={t("playback.moment.privateStatus")} />}
            <Text variant="bodyMd" color="onSurfaceVariant">
              {visibility === "public" ? t("playback.moment.publicStatus") : t("playback.moment.privateStatus")}
            </Text>
          </View>
          {visibility === "private" ? (
            <Button
              testID="moment-publish"
              label={t("playback.moment.publishAndShare")}
              onPress={() => void changeVisibility("public")}
              loading={setVisibility.isPending}
              loadingLabel={t("playback.moment.saving")}
            />
          ) : (
            <View style={styles.actions}>
              <Button testID="moment-share" label={t("playback.moment.shareMoment")} onPress={() => void share()} loading={shareBusy} loadingLabel={t("playback.moment.sharing")} />
              <Button variant="ghost" testID="moment-make-private" label={t("playback.moment.makePrivate")} onPress={() => void changeVisibility("private")} loading={setVisibility.isPending} />
            </View>
          )}
          {shareError && content ? (
            <View style={styles.recovery} accessibilityLiveRegion="polite">
              <Text color="onError" variant="bodyMd">{t("playback.moment.shareError")}</Text>
              <Text selectable color="onSurfaceVariant" variant="bodyMd">{content.url}</Text>
              <Button variant="ghost" label={t("playback.moment.retryShare")} onPress={() => void share()} />
            </View>
          ) : null}
          <Text color="onSurfaceVariant" variant="bodyMd" style={styles.privateHelp}>{t("playback.moment.privateFeedback")}</Text>
          <FeedbackQuestion
            label={t("playback.moment.surprised")}
            value={surprised}
            disabled={setFeedback.isPending}
            onChange={(value) => void answer("surprised", value)}
          />
          {feedbackError === "surprised" ? <Text color="onError" variant="bodyMd">{t("playback.moment.feedbackError")}</Text> : null}
          <FeedbackQuestion
            label={t("playback.moment.wouldShare")}
            value={wouldShare}
            disabled={setFeedback.isPending}
            onChange={(value) => void answer("wouldShare", value)}
          />
          {feedbackError === "wouldShare" ? <Text color="onError" variant="bodyMd">{t("playback.moment.feedbackError")}</Text> : null}
          {audioUrl ? null : <Text color="onError" variant="bodyMd">{t("playback.moment.audioUnavailable")}</Text>}
        </>
      )}
    </GlassCard>
  );
}

function FeedbackQuestion({ label, value, disabled, onChange }: Readonly<{ label: string; value: boolean | null; disabled: boolean; onChange(value: boolean): void }>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.question}>
      <Text variant="bodyMd">{label}</Text>
      <View style={styles.choices}>
        <Choice label="Yes" selected={value === true} disabled={disabled} onPress={() => onChange(true)} />
        <Choice label="No" selected={value === false} disabled={disabled} onPress={() => onChange(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: { marginTop: theme.spacing.stackLg, gap: theme.spacing.stackMd },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.stackSm },
  heading: { flex: 1, gap: theme.spacing.stackXs },
  identityRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.stackSm, marginTop: theme.spacing.stackXs },
  identityCopy: { flex: 1, minWidth: 0, gap: theme.spacing.stackXs },
  artwork: { width: 56, height: 56, borderRadius: theme.borderRadius.md },
  iconAction: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  status: { paddingVertical: theme.spacing.stackXs, flexDirection: "row", alignItems: "center", gap: theme.spacing.stackSm },
  actions: { gap: theme.spacing.stackSm },
  privateHelp: { marginTop: theme.spacing.stackXs },
  question: { gap: theme.spacing.stackSm },
  choices: { flexDirection: "row", gap: theme.spacing.stackSm },
  choice: { minHeight: 44, minWidth: 72, paddingHorizontal: theme.spacing.stackMd, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.glassBorder, borderRadius: theme.borderRadius.md },
  choiceSelected: { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary },
  recovery: { gap: theme.spacing.stackXs },
  disabled: { opacity: 0.5 },
}));
