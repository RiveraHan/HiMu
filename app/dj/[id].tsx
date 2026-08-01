import { getEdgeErrorCode } from "@/src/api/edge-errors";
import {
  AuthScopeChangedError,
  isCurrentMutationUser,
} from "@/src/api/auth-scope";
import { useActivity } from "@/src/activity";
import { usePlayer } from "@/src/audio/use-player";
import {
  DjHero,
  GeneratingTrackCard,
  GlassInput,
  IconButton,
  ScreenHeader,
  StatCard,
  StatCardSkeleton,
  StateNotice,
  Tag,
  Text,
  TrackCard,
} from "@/src/components";
import {
  DjProfileSkeleton,
  DjTracksSkeleton,
} from "@/src/components/dj/DjProfileSkeleton";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useConfirm } from "@/src/hooks/use-confirm";
import { useDeleteDJ } from "@/src/hooks/use-delete-dj";
import { useDJ, useDJTracks } from "@/src/hooks/use-dj";
import { useGenerateMix } from "@/src/hooks/use-generate-mix";
import { useLiveDJIds } from "@/src/hooks/use-home";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useToast } from "@/src/hooks/use-toast";
import { catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import { TourTarget, useAppTour } from "@/src/onboarding";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { router, useLocalSearchParams } from "expo-router";
import {
  AudioLines,
  Music2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function DJProfileScreen() {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const { id, highlightTrackId } = useLocalSearchParams<{
    id: string;
    highlightTrackId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();

  const djQuery = useDJ(id);
  const tracksQuery = useDJTracks(id);
  const dj = djQuery.data;
  const tracks = tracksQuery.data;
  const djLoading = isInitialQueryLoading(djQuery);
  const tracksLoading = isInitialQueryLoading(tracksQuery);
  const isOnline = useOnlineStatus();
  const { data: liveIds } = useLiveDJIds();
  const { load } = usePlayer();
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const toast = useToast();
  const confirm = useConfirm();
  const { registerContextTarget } = useAppTour();
  const djReady =
    !djLoading && !djQuery.isError && dj !== undefined && dj !== null && dj.id === id;

  useEffect(() => {
    if (!djReady) return;
    return registerContextTarget({
      tipId: "dj.hero",
      targetId: "dj.hero",
      ready: true,
    });
  }, [djReady, id, registerContextTarget]);

  const { generate, isStarting } = useGenerateMix();
  const { activeMixForDj } = useActivity();
  const activeMix = activeMixForDj(id);
  const isGenerating =
    isStarting ||
    activeMix?.status === "queued" ||
    activeMix?.status === "running" ||
    activeMix?.status === "slow";

  const user = useCurrentUser();
  const isOwner = !!dj?.owner_id && dj.owner_id === user?.id;

  // is_instrumental lives in dj_generation_configs (closed to the client);
  // the wizard mirrors it into personality_traits so the UI can read it.
  const traits = (dj?.personality_traits ?? null) as {
    isInstrumental?: boolean;
  } | null;

  const isVocal = traits?.isInstrumental === false;
  const [lyricsText, setLyricsText] = useState("");
  const { mutate: deleteDJ, isPending: isDeleting } = useDeleteDJ();

  const queue: PlayerTrack[] = useMemo(
    () =>
      (tracks ?? [])
        .filter(
          (t): t is typeof t & { audio_url: string } => t.audio_url != null,
        )
        .map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          audio_url: t.audio_url,
          album_art_url: t.album_art_url,
          duration: t.duration,
          genre: t.genre,
        })),
    [tracks],
  );
  const knownTrackCount =
    tracksQuery.isError && tracks === undefined ? null : queue.length;

  function onGeneratePress() {
    if (isGenerating || !dj) return;
    const submittedUserId = user?.id;
    if (!submittedUserId) return;
    const lyrics = lyricsText.trim();
    generate(
      {
        djId: id,
        title: dj.name,
        lyrics: isOwner && isVocal && lyrics ? lyrics : undefined,
      },
      {
        onError: async (e) => {
          if (
            e instanceof AuthScopeChangedError ||
            !isCurrentMutationUser(submittedUserId)
          ) return;
          const code = await getEdgeErrorCode(e);
          if (!isCurrentMutationUser(submittedUserId)) return;
          toast.error(
            t("dj.profile.startErrorTitle"),
            code === "daily_quota_reached"
              ? t("dj.profile.quotaError")
              : code === "dj_not_allowed"
                ? t("dj.profile.notAllowedError")
                : t("dj.profile.genericError"),
          );
        },
      },
    );
  }

  const onDeletePress = async () => {
    const submittedUserId = user?.id;
    if (!dj || !submittedUserId) return;
    const ok = await confirm({
      title: t("dj.profile.delete.title"),
      message: knownTrackCount === null || tracksLoading
        ? t("dj.profile.delete.messageUnknown")
        : t("dj.profile.delete.message", {
            name: dj.name,
            count: knownTrackCount,
          }),
      confirmLabel: t("dj.profile.delete.confirm"),
      destructive: true,
    });
    if (!ok || !isCurrentMutationUser(submittedUserId)) return;
    deleteDJ(
      { djId: id },
      {
        onSuccess: () => {
          if (isCurrentMutationUser(submittedUserId)) router.back();
        },
        onError: (error) => {
          if (
            error instanceof AuthScopeChangedError ||
            !isCurrentMutationUser(submittedUserId)
          ) return;
          toast.error(
            t("dj.profile.delete.errorTitle"),
            t("dj.profile.delete.error"),
          );
        },
      },
    );
  };

  const header = (
    <ScreenHeader
      actions={
        isOwner ? (
          <>
            <IconButton
              variant="glass"
              icon={
                <SlidersHorizontal size={20} color={theme.colors.onSurface} />
              }
              onPress={() => router.push(`/train-dj/${id}`)}
              disabled={isDeleting}
              accessibilityLabel={t("dj.profile.trainAction")}
            />
            <IconButton
              variant="glass"
              icon={<Trash2 size={20} color={theme.colors.error} />}
              onPress={onDeletePress}
              disabled={isDeleting}
              accessibilityLabel={t("dj.profile.deleteAction")}
            />
          </>
        ) : undefined
      }
    />
  );

  const unavailableScreen = (notice: React.ReactNode) => (
    <View style={styles.root}>
      <View
        style={[styles.body, { paddingTop: insets.top + theme.spacing.stackMd }]}
      >
        {header}
      </View>
      <View style={styles.center}>{notice}</View>
    </View>
  );

  if (!isOnline && dj === undefined) {
    return unavailableScreen(
      <StateNotice
        kind="offline"
        title={t("common.errors.offline")}
        message={t("common.errors.reconnect")}
      />,
    );
  }

  if (djQuery.isError && !dj) {
    return unavailableScreen(
      <StateNotice
        kind="error"
        title={t("dj.profile.unavailable")}
        actionLabel={t("dj.profile.retry")}
        onAction={() => void djQuery.refetch()}
      />,
    );
  }

  if (djLoading || dj === undefined) {
    return (
      <DjProfileSkeleton
        header={header}
        paddingTop={insets.top + theme.spacing.stackMd}
        paddingBottom={paddingBottom}
      />
    );
  }

  if (dj === null) {
    return (
      <View style={styles.root}>
        <View
          style={[
            styles.body,
            { paddingTop: insets.top + theme.spacing.stackMd },
          ]}
        >
          {header}
        </View>
        <View style={styles.center}>
          <Text variant="h2">{t("dj.profile.notFound")}</Text>
          <Text variant="bodyMd" color="onSurfaceVariant">
            {t("dj.profile.notFoundDescription")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.body,
            { paddingTop: insets.top + theme.spacing.stackMd },
          ]}
        >
          {header}

          {!isOnline ? (
            <StateNotice
              compact
              kind="offline"
              title={t("common.errors.offline")}
              message={t("common.errors.reconnect")}
            />
          ) : djQuery.isError ? (
            <StateNotice
              compact
              kind="error"
              title={t("dj.profile.unavailable")}
              actionLabel={t("dj.profile.retry")}
              onAction={() => void djQuery.refetch()}
            />
          ) : null}

          {djReady ? (
            <TourTarget id="dj.hero" borderRadius={theme.borderRadius["2xl"]}>
              <DjHero
                name={dj.name}
                avatarUrl={dj.avatar_url}
                isLive={!!liveIds?.has(id)}
                tagline={
                  isOwner
                    ? t("dj.profile.ownedBadge")
                    : dj.is_premium
                      ? t("dj.profile.residentBadge")
                      : undefined
                }
              />
            </TourTarget>
          ) : (
            <DjHero
              name={dj.name}
              avatarUrl={dj.avatar_url}
              isLive={!!liveIds?.has(id)}
              tagline={
                isOwner
                  ? t("dj.profile.ownedBadge")
                  : dj.is_premium
                    ? t("dj.profile.residentBadge")
                    : undefined
              }
            />
          )}

          {/* Stats remap */}
          <View style={styles.statsRow}>
            {tracksLoading ? (
              <StatCardSkeleton />
            ) : (
              <StatCard
                icon={
                  <AudioLines
                    size={20}
                    color={theme.colors.primaryContainer}
                  />
                }
                value={knownTrackCount === null ? "—" : String(knownTrackCount)}
                label={
                  knownTrackCount === null
                    ? t("dj.profile.trackCountUnavailable")
                    : t("dj.profile.stats.tracks", {
                        count: knownTrackCount,
                      })
                }
              />
            )}
            <StatCard
              icon={<Music2 size={20} color={theme.colors.tertiary} />}
              value={String(dj.genre_specialties?.length ?? 0)}
              label={t("dj.profile.stats.genres", {
                count: dj.genre_specialties?.length ?? 0,
              })}
            />
          </View>

          {/* Own lyrics: only for your vocal DJs (server re-validates) */}
          {isOwner && isVocal && (
            <GlassInput
              label={t("dj.profile.lyricsLabel")}
              hint={t("dj.profile.lyricsHint")}
              placeholder={t("dj.profile.lyricsPlaceholder")}
              multiline
              maxLength={1000}
              value={lyricsText}
              onChangeText={setLyricsText}
              editable={!isGenerating}
            />
          )}

          {/* Generate a new mix in this DJ's style */}
          <Pressable
            onPress={onGeneratePress}
            disabled={isGenerating}
            accessibilityRole="button"
            accessibilityLabel={t("dj.profile.generateAction")}
            accessibilityState={{ disabled: isGenerating }}
            style={({ pressed }) => [
              styles.generateBtn,
              pressed && !isGenerating && styles.pressed,
            ]}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator color={theme.colors.onPrimary} />
                <Text variant="labelCaps" color="onPrimary">
                  {t("dj.profile.generating")}
                </Text>
              </>
            ) : (
              <>
                <Sparkles size={20} color={theme.colors.onPrimary} />
                <Text variant="labelCaps" color="onPrimary">
                  {t("dj.profile.generateButton")}
                </Text>
              </>
            )}
          </Pressable>

          {/* Sonic Philosophy */}

          {!!dj.character && (
            <View style={styles.section}>
              <Text
                variant="labelCaps"
                color="onSurfaceVariant"
                style={styles.sectionLabel}
              >
                {t("dj.profile.sonicPhilosophy")}
              </Text>
              <Text variant="bodyMd" color="onSurfaceVariant">
                {dj.character}
              </Text>
            </View>
          )}

          {/* Curated Genres */}
          {!!dj.genre_specialties?.length && (
            <View style={styles.section}>
              <Text
                variant="labelCaps"
                color="onSurfaceVariant"
                style={styles.sectionLabel}
              >
                {t("dj.profile.curatedGenres")}
              </Text>
              <View style={styles.tagWrap}>
                {dj.genre_specialties.map((g: string) => (
                  <Tag
                    key={g}
                    label={catalogLabel(g, resolvedLanguage)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Tracks */}
          {tracksLoading ? (
            <DjTracksSkeleton />
          ) : (
            <View style={styles.section}>
              <Text
                variant="labelCaps"
                color="onSurfaceVariant"
                style={styles.sectionLabel}
              >
                {t("dj.profile.tracks")}
              </Text>
              {tracksQuery.isError && !tracks ? (
                <StateNotice
                  kind="error"
                  title={t("dj.profile.tracksUnavailable")}
                  actionLabel={t("dj.profile.retry")}
                  onAction={() => void tracksQuery.refetch()}
                />
              ) : tracksQuery.isError || queue.length > 0 || isGenerating ? (
                <View style={styles.trackList}>
                  {isGenerating && <GeneratingTrackCard vocal={isVocal} />}
                  {tracksQuery.isError ? (
                    <StateNotice
                      compact
                      kind="error"
                      title={t("dj.profile.tracksUnavailable")}
                      actionLabel={t("dj.profile.retry")}
                      onAction={() => void tracksQuery.refetch()}
                    />
                  ) : null}
                  {queue.map((track, index) => (
                    <TrackCard
                      key={track.id}
                      highlighted={track.id === highlightTrackId}
                      highlightedLabel={t("dj.profile.newBadge")}
                      accessibilityHint={
                        track.id === highlightTrackId
                          ? t("dj.profile.newlyGeneratedHint")
                          : undefined
                      }
                      title={track.title}
                      artist={track.artist}
                      cover={track.album_art_url}
                      variant="row"
                      isPlaying={currentId === track.id}
                      onPress={() => load(track, queue, index)}
                    />
                  ))}
                </View>
              ) : (
                <Text
                  variant="bodyMd"
                  color="onSurfaceVariant"
                  opacity={0.7}
                >
                  {t("dj.profile.noTracks")}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  body: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.stackLg,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.gutter,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
    paddingVertical: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.full,
    borderCurve: "continuous",
    backgroundColor: theme.colors.primary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  section: { gap: theme.spacing.stackSm },
  sectionLabel: { letterSpacing: 2 },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.stackSm,
  },
  trackList: { gap: theme.spacing.stackMd },
  pressed: { opacity: 0.6 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
    padding: theme.spacing.pageMargin,
  },
}));
