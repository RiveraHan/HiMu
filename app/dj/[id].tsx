import { getEdgeErrorCode } from "@/src/api/edge-errors";
import { queryKeys } from "@/src/api/queries";
import { usePlayer } from "@/src/audio/use-player";
import {
  DjHero,
  GeneratingTrackCard,
  GlassInput,
  IconButton,
  ScreenHeader,
  StatCard,
  StatCardSkeleton,
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
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useToast } from "@/src/hooks/use-toast";
import { catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import { TourTarget, useAppTour } from "@/src/onboarding";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { useQueryClient } from "@tanstack/react-query";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();

  const djQuery = useDJ(id);
  const tracksQuery = useDJTracks(id);
  const dj = djQuery.data;
  const tracks = tracksQuery.data;
  const djLoading = isInitialQueryLoading(djQuery);
  const tracksLoading = isInitialQueryLoading(tracksQuery);
  const { data: liveIds } = useLiveDJIds();
  const { load } = usePlayer();
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const queryClient = useQueryClient();
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

  const {
    generate,
    isStarting,
    status: genStatus,
    track: generatedTrack,
    reset: resetGen,
  } = useGenerateMix();
  const isGenerating =
    isStarting || genStatus === "queued" || genStatus === "generating";

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

  // When a generated mix is ready, play it, refresh track lists, and clear the job.
  useEffect(() => {
    if (genStatus === "ready" && generatedTrack && generatedTrack.audio_url) {
      load({
        id: generatedTrack.id,
        title: generatedTrack.title,
        artist: generatedTrack.artist,
        audio_url: generatedTrack.audio_url,
        album_art_url: generatedTrack.album_art_url,
        duration: generatedTrack.duration,
        genre: generatedTrack.genre,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.tracks.all });
      resetGen();
    } else if (genStatus === "failed") {
      toast.error(
        t("dj.profile.generationFailedTitle"),
        t("dj.profile.generationFailed"),
      );
      resetGen();
    }
  }, [genStatus, generatedTrack, load, resetGen, queryClient, t, toast]);

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

  function onGeneratePress() {
    if (isGenerating) return;
    const lyrics = lyricsText.trim();
    generate(
      {
        djId: id,
        lyrics: isOwner && isVocal && lyrics ? lyrics : undefined,
      },
      {
        onError: async (e) => {
          const code = await getEdgeErrorCode(e);
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
    if (!dj) return;
    const ok = await confirm({
      title: t("dj.profile.delete.title"),
      message: tracksLoading
        ? t("dj.profile.delete.messageUnknown", { name: dj.name })
        : t("dj.profile.delete.message", {
            name: dj.name,
            count: tracks?.length ?? 0,
          }),
      confirmLabel: t("dj.profile.delete.confirm"),
      destructive: true,
    });
    if (!ok) return;
    deleteDJ(
      { djId: id },
      {
        onSuccess: () => router.back(),
        onError: () =>
          toast.error(
            t("dj.profile.delete.errorTitle"),
            t("dj.profile.delete.error"),
          ),
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

  if (djLoading) {
    return (
      <DjProfileSkeleton
        header={header}
        paddingTop={insets.top + theme.spacing.stackMd}
        paddingBottom={paddingBottom}
      />
    );
  }

  if (!dj) {
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
                value={String(tracks?.length ?? 0)}
                label={t("dj.profile.stats.tracks", {
                  count: tracks?.length ?? 0,
                })}
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
              {queue.length > 0 || isGenerating ? (
                <View style={styles.trackList}>
                  {/* The new mix lands right here when it's ready */}
                  {isGenerating && <GeneratingTrackCard vocal={isVocal} />}
                  {queue.map((t, i) => (
                    <TrackCard
                      key={t.id}
                      title={t.title}
                      artist={t.artist}
                      cover={t.album_art_url}
                      variant="row"
                      isPlaying={currentId === t.id}
                      onPress={() => load(t, queue, i)}
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
