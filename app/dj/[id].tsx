import {
  AuthScopeChangedError,
  isCurrentMutationUser,
} from "@/src/api/auth-scope";
import { useActivity } from "@/src/activity";
import { usePlayer } from "@/src/audio/use-player";
import {
  DjHero,
  GeneratingTrackCard,
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
import { useLiveDJIds } from "@/src/hooks/use-home";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useToast } from "@/src/hooks/use-toast";
import { catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import { TourTarget, useAppTour } from "@/src/onboarding";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
  AudioLines,
  Music2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
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

  const { activeMixForDj } = useActivity();
  const activeMix = activeMixForDj(id);
  const isGenerating =
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
          owner_id: t.owner_id,
          is_public: t.is_public,
        })),
    [tracks],
  );
  const knownTrackCount =
    tracksQuery.isError && tracks === undefined ? null : queue.length;

  function onPreparePress() {
    if (isGenerating || !isOwner) return;
    router.push(
      { pathname: "/create-track", params: { djId: id } } as unknown as Href,
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
                isPrivate={isOwner && dj.is_public === false}
                privateLabel={t("dj.visibility.privateLabel")}
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
              isPrivate={isOwner && dj.is_public === false}
              privateLabel={t("dj.visibility.privateLabel")}
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

          {isOwner ? (
            <Pressable
              onPress={onPreparePress}
              disabled={isGenerating}
              accessibilityRole="button"
              accessibilityLabel={t("dj.profile.prepareAction")}
              accessibilityState={{ disabled: isGenerating }}
              style={({ pressed }) => [
                styles.generateBtn,
                pressed && !isGenerating && styles.pressed,
              ]}
            >
              <Sparkles size={20} color={theme.colors.onPrimary} />
              <Text variant="labelCaps" color="onPrimary">
                {isGenerating
                  ? t("dj.profile.generating")
                  : t("dj.profile.prepareButton")}
              </Text>
            </Pressable>
          ) : null}

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
                      isPrivate={
                        track.owner_id === user?.id && track.is_public === false
                      }
                      privateLabel={t("dj.visibility.privateLabel")}
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
