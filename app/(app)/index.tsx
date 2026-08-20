import { usePlayer } from "@/src/audio/use-player";
import {
  Avatar,
  CaptionVoiceButton,
  ContentShelf,
  ContentShelfSkeleton,
  DJAvatar,
  LibraryCard,
  OnAirHero,
  ScreenScrollView,
  StateNotice,
  Text,
  VibeSpotlightCard,
} from "@/src/components";
import { FocusOrb } from "@/src/components/focus/FocusOrb";
import {
  HomeDjsSkeleton,
  HomeHeroSkeleton,
  HomeLibraryRowSkeleton,
  HomeVibeSkeleton,
} from "@/src/components/home/HomeSkeletons";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useDailyDrop } from "@/src/hooks/use-daily-drop";
import { useFavorites } from "@/src/hooks/use-favorites";
import {
  toPlayerTrack,
  useAIMixTracks,
  useDJs,
  useLiveDJIds,
  useOnAirHero,
  useRecentTracks,
  useTimeOfDayShelf,
  type ContextualTrack,
  type RecentTrack,
} from "@/src/hooks/use-home";
import { useTabBarPadding } from "@/src/hooks/use-tab-bar-padding";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useTasteProfile } from "@/src/hooks/use-taste-profile";
import { useToast } from "@/src/hooks/use-toast";
import { useVibeCheck } from "@/src/hooks/use-vibe-check";
import { catalogLabel } from "@/src/i18n/catalog-labels";
import {
  ContinueTourCard,
  TourTarget,
  useAppTour,
  type HomeTourRegistration,
} from "@/src/onboarding";
import {
  HomeDesktopGrid,
  HomeDesktopGridSlot,
} from "@/src/components/home/HomeDesktopGrid";
import { HOME_TOUR_STEPS } from "@/src/onboarding/constants";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { formatHours } from "@/src/utils/format-stats";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { weightedShuffle } from "@/src/utils/weighted-shuffle";
import { resolveLayoutMode, type LayoutMode } from "@/src/theme/layout";
import { router } from "expo-router";
import { ChevronRight, Play, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

const MAX_OWNED_DJS = 1;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage === "es" ? "es" : "en";
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  // Start compact so the server and first client render have the same tree.
  // The mode only selects an existing shelf presentation after hydration.
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("compact");
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const toast = useToast();
  const online = useOnlineStatus();
  const djsQuery = useDJs();
  const liveQuery = useLiveDJIds();
  const aiMixQuery = useAIMixTracks();
  const favoritesQuery = useFavorites();
  const { load } = usePlayer();
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const paddingBottom = useTabBarPadding();
  const homeScrollRef = useRef<{ scrollTo(options: { y: number; animated: boolean }): void } | null>(null);
  const targetOffsetsRef = useRef(new Map<string, number>());
  const pendingScrollRef = useRef<{
    resolve: () => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    setLayoutMode(resolveLayoutMode(width));
  }, [width]);

  const { data: hero } = useOnAirHero();
  const recentQuery = useRecentTracks();
  const contextualQuery = useTimeOfDayShelf();
  const vibeQuery = useVibeCheck();
  const taste = useTasteProfile();
  const drop = useDailyDrop();
  const {
    canContinue,
    continueTour,
    dismissActiveTour,
    registerHome,
  } = useAppTour();

  const djs = djsQuery.data;
  const liveDJIds = liveQuery.data;
  const aiMix = aiMixQuery.data;
  const recent = recentQuery.data;
  const contextual = contextualQuery.data;
  const favorites = favoritesQuery.data;
  const vibe = vibeQuery.data;

  const ownCount = djs?.filter((d) => d.owner_id === user?.id).length ?? 0;

  const djsLoading = isInitialQueryLoading(djsQuery);
  const recentLoading = isInitialQueryLoading(recentQuery);
  const contextualLoading = isInitialQueryLoading(contextualQuery);
  const favoritesLoading = isInitialQueryLoading(favoritesQuery);
  const vibeLoading = isInitialQueryLoading(vibeQuery);
  const aiMixLoading = isInitialQueryLoading(aiMixQuery);

  const blockingDjsError = djsQuery.isError && djs === undefined;
  const blockingRecentError = recentQuery.isError && recent === undefined;
  const blockingContextualError = contextualQuery.isError && contextual === undefined;
  const blockingAiMixError = aiMixQuery.isError && aiMix === undefined;
  const blockingFavoritesError = favoritesQuery.isError && favorites === undefined;
  const blockingVibeError = vibeQuery.isError && vibe === undefined;
  const djsOfflineWithoutData = !online && djsQuery.fetchStatus === "paused" && djs === undefined;
  const recentOfflineWithoutData = !online && recentQuery.fetchStatus === "paused" && recent === undefined;
  const contextualOfflineWithoutData = !online && contextualQuery.fetchStatus === "paused" && contextual === undefined;
  const aiMixOfflineWithoutData = !online && aiMixQuery.fetchStatus === "paused" && aiMix === undefined;
  const favoritesOfflineWithoutData = !online && favoritesQuery.fetchStatus === "paused" && favorites === undefined;
  const vibeOfflineWithoutData = !online && vibeQuery.fetchStatus === "paused" && vibe === undefined;
  const heroOfflineWithoutData =
    drop.status === "idle" &&
    !hero &&
    (djsOfflineWithoutData || recentOfflineWithoutData);
  const hasCachedHomeData = [djs, liveDJIds, aiMix, recent, contextual, favorites, vibe]
    .some((value) => value !== undefined);

  const showHeroSkeleton =
    (drop.status === "idle" && (djsLoading || recentLoading)) ||
    (drop.status === "failed" && !hero && recentLoading) ||
    (drop.status === "pending" && !drop.dj && !hero);

  const heroTrackId = hero?.track.id ?? null;

  const freshTracks = useMemo<PlayerTrack[]>(() => {
    if (!recent) return [];
    return recent
      .filter((t: RecentTrack) => t.audio_url != null && t.id !== heroTrackId)
      .slice(0, 12)
      .map((t: RecentTrack) => ({
        ...toPlayerTrack(t),
        artist: t.dj?.name ?? t.artist,
      }));
  }, [recent, heroTrackId]);

  const contextualTracks = useMemo<PlayerTrack[]>(() => {
    const pool = ((contextual?.tracks ?? []) as ContextualTrack[]).filter(
      (t: ContextualTrack) => t.audio_url != null && t.id !== heroTrackId,
    );
    return weightedShuffle<ContextualTrack>(pool, taste)
      .slice(0, 12)
      .map(toPlayerTrack);
  }, [contextual, heroTrackId, taste]);

  const playableAiMixes = useMemo<PlayerTrack[]>(() => weightedShuffle(
    (aiMix ?? []).filter(
      (track): track is typeof track & { audio_url: string } =>
        track.audio_url != null,
    ),
    taste,
  ).map(toPlayerTrack), [aiMix, taste]);

  function getGreeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) return t("home.greeting.morning");
    if (hour < 18) return t("home.greeting.afternoon");
    return t("home.greeting.evening");
  }

  function playAIMixes() {
    if (!playableAiMixes.length) return;
    setRepeatMode("all"); // continuous, looping session
    load(playableAiMixes[0], playableAiMixes, 0);
  }

  const playHero = useCallback(() => {
    if (!hero) return;
    const i = hero.queue.findIndex((t) => t.id === hero.track.id);
    setRepeatMode("all");
    load(hero.track, hero.queue, i < 0 ? 0 : i);
  }, [hero, load, setRepeatMode]);

  const playDrop = useCallback(() => {
    if (!drop.track) return;
    setRepeatMode("off");
    load(drop.track, [drop.track], 0);
  }, [drop.track, load, setRepeatMode]);

  const playFromShelf = useCallback((
    tracks: PlayerTrack[],
    track: PlayerTrack,
    index: number,
  ) => {
    setRepeatMode("all");
    load(track, tracks, index);
  }, [load, setRepeatMode]);

  const hasPlayableCandidate =
    (drop.status === "ready" && drop.track != null) ||
    hero != null ||
    freshTracks.length > 0;

  const playFirstAvailable = useCallback(async (): Promise<boolean> => {
    try {
      if (drop.status === "ready" && drop.track) {
        setRepeatMode("off");
        return await load(drop.track, [drop.track], 0);
      }
      if (hero) {
        const index = hero.queue.findIndex((track) => track.id === hero.track.id);
        setRepeatMode("all");
        return await load(hero.track, hero.queue, index < 0 ? 0 : index);
      }
      const firstRecent = freshTracks[0];
      if (!firstRecent) return false;
      setRepeatMode("all");
      return await load(firstRecent, freshTracks, 0);
    } catch {
      return false;
    }
  }, [drop.status, drop.track, freshTracks, hero, load, setRepeatMode]);

  const hasHeroTarget =
    (drop.status === "ready" && drop.track != null && drop.dj != null) ||
    (drop.status === "failed" && hero != null);
  const hasDjsTarget = !djsLoading && djs != null && djs.length > 0;
  const availableHomeSteps = useMemo(
    () => HOME_TOUR_STEPS.filter((step) =>
      step.targetId === "tabs.discover" ||
      (step.targetId === "home.hero" && hasHeroTarget) ||
      (step.targetId === "home.djs" && hasDjsTarget)),
    [hasDjsTarget, hasHeroTarget],
  );
  const noDropCanBeGenerated = !djsLoading && djs?.length === 0;
  const homeContentSettled =
    !djsLoading &&
    !showHeroSkeleton &&
    (drop.status !== "idle" || noDropCanBeGenerated);
  const captureTargetOffset = useCallback((stepId: string) =>
    (event: LayoutChangeEvent) => {
      targetOffsetsRef.current.set(stepId, event.nativeEvent.layout.y);
    }, []);
  const settlePendingScroll = useCallback(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;
    clearTimeout(pending.timer);
    pending.resolve();
  }, []);
  const ensureStepVisible = useCallback(async (stepId: string) => {
    const y = targetOffsetsRef.current.get(stepId);
    if (y === undefined || !homeScrollRef.current) return;
    settlePendingScroll();
    const settled = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (pendingScrollRef.current?.timer === timer) settlePendingScroll();
      }, 750);
      pendingScrollRef.current = { resolve, timer };
    });
    homeScrollRef.current.scrollTo({ y: Math.max(0, y - insets.top - 16), animated: true });
    await settled;
  }, [insets.top, settlePendingScroll]);
  useEffect(() => settlePendingScroll, [settlePendingScroll]);
  const homeRegistration = useMemo<HomeTourRegistration>(() => ({
    ready: homeContentSettled,
    steps: availableHomeSteps,
    hasPlayableCandidate,
    ensureStepVisible,
    playFirstAvailable,
  }), [availableHomeSteps, ensureStepVisible, hasPlayableCandidate, homeContentSettled, playFirstAvailable]);

  useEffect(
    () => registerHome(homeRegistration),
    [homeRegistration, registerHome],
  );

  const openDiscover = () => router.push("/discover");
  const djsSection = (
    <View style={styles.section}>
      <Text variant="h2">{t("home.yourDjs")}</Text>
      {blockingDjsError ? (
        <StateNotice
          compact
          kind={online ? "error" : "offline"}
          title={t("home.djsUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djsQuery.refetch()}
        />
      ) : null}
      {djs !== undefined ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={styles.horizontalList}
        >
          {djs.map((dj) => (
            <DJAvatar
              key={dj.id}
              src={dj.avatar_url}
              fallback={dj.name}
              name={dj.name}
              subtitle={dj.genre_specialties?.[0]
                ? catalogLabel(dj.genre_specialties[0], resolvedLanguage)
                : undefined}
              isLive={liveDJIds?.has(dj.id) ?? false}
              isPrivate={dj.owner_id === user?.id && dj.is_public === false}
              privateLabel={t("dj.visibility.privateLabel")}
              onPress={() => router.push(`/dj/${dj.id}`)}
            />
          ))}
          <Pressable
            onPress={() => {
              if (ownCount >= MAX_OWNED_DJS) {
                toast.warning(t("home.djLimit.title"), t("home.djLimit.message", {
                  limit: MAX_OWNED_DJS,
                }));
                return;
              }
              router.push("/create-dj");
            }}
            style={({ pressed }) => [styles.newDJSlot, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("home.newDj")}
          >
            <View style={styles.newDJCircle}>
              <Svg width={48} height={48} style={StyleSheet.absoluteFillObject}>
                <Circle
                  cx={24}
                  cy={24}
                  r={23}
                  stroke={theme.colors.outlineVariant}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="transparent"
                />
              </Svg>
              <Plus size={24} color={theme.colors.onSurfaceVariant} />
            </View>
            <Text variant="bodyMd" numberOfLines={1} style={styles.newDJLabel}>
              {t("home.newDj")}
            </Text>
            <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6} style={styles.newDJLabel}>
              {t("home.create")}
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}
      {djsQuery.isError && djs !== undefined ? (
        <StateNotice
          compact
          kind={online ? "error" : "offline"}
          title={t("home.djsUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djsQuery.refetch()}
        />
      ) : null}
      {liveQuery.isError ? (
        <StateNotice
          compact
          kind={online ? "error" : "offline"}
          title={t("home.liveDjsUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void liveQuery.refetch()}
        />
      ) : null}
    </View>
  );

  return (
    <ScreenScrollView
      onScrollRef={(node) => { homeScrollRef.current = node; }}
      onMomentumScrollEnd={settlePendingScroll}
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
    >
        {/* Header: greeting + profile shortcut */}
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text variant="h1">{getGreeting()}</Text>
            <Text variant="bodyLg" color="onSurfaceVariant" opacity={0.6}>
              {t("home.subtitle")}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            accessibilityRole="button"
            accessibilityLabel={t("home.openProfile")}
            style={({ pressed }) => [styles.profileShortcut, pressed && styles.pressed]}
          >
            <Avatar
              src={user?.user_metadata?.avatar_url}
              fallback={user?.email ?? "U"}
              size="md"
            />
          </Pressable>
        </View>

        {canContinue ? (
          <ContinueTourCard
            onContinue={continueTour}
            onDismiss={dismissActiveTour}
          />
        ) : null}

        {!online && hasCachedHomeData ? (
          <StateNotice
            compact
            kind="offline"
            title={t("common.errors.offline")}
            message={t("common.errors.reconnect")}
          />
        ) : null}

        <HomeDesktopGrid layoutMode={layoutMode}>
        <HomeDesktopGridSlot slot="hero">
        {heroOfflineWithoutData ? (
          <StateNotice
            compact
            kind="offline"
            title={t("common.errors.offline")}
            message={t("common.errors.reconnect")}
            actionLabel={t("common.actions.retry")}
            onAction={() => {
              if (djs === undefined) void djsQuery.refetch();
              if (recent === undefined) void recentQuery.refetch();
            }}
          />
        ) : showHeroSkeleton ? (
          <HomeHeroSkeleton />
        ) : drop.status === "ready" && drop.track && drop.dj ? (
          <TourTarget id="home.hero" borderRadius={theme.borderRadius["2xl"]} onLayout={captureTargetOffset("home.daily-drop")}>
            <OnAirHero
              eyebrow={t("home.dailyDrop.eyebrow")}
              djName={drop.dj.name}
              avatarUrl={drop.dj.avatar_url}
              genre={drop.dj.genre}
              headline={drop.caption ?? t("home.dailyDrop.fresh")}
              trackTitle={drop.track.title}
              isLive={false}
              onPlay={playDrop}
              voiceSlot={
                drop.captionAudioUrl ? (
                  <CaptionVoiceButton audioUrl={drop.captionAudioUrl} />
                ) : undefined
              }
            />
          </TourTarget>
        ) : drop.status === "pending" && drop.dj ? (
          <OnAirHero
            eyebrow={t("home.dailyDrop.eyebrow")}
            pending
            djName={drop.dj.name}
            avatarUrl={drop.dj.avatar_url}
            genre={drop.dj.genre}
            headline={t("home.dailyDrop.making")}
            trackTitle=""
            isLive={false}
            onPlay={() => {}}
          />
        ) : drop.status === "failed" && hero ? (
          <TourTarget id="home.hero" borderRadius={theme.borderRadius["2xl"]} onLayout={captureTargetOffset("home.daily-drop")}>
            <OnAirHero
              djName={hero.dj.name}
              avatarUrl={hero.dj.avatar_url}
              genre={hero.dj.genre}
              headline={hero.bucket
                ? t(`home.timeOfDay.${hero.bucket}.headline`)
                : t("home.dailyDrop.fresh")}
              trackTitle={hero.track.title}
              isLive={hero.isLive}
              onPlay={playHero}
            />
          </TourTarget>
        ) : null}

        {drop.status === "failed" || drop.stale ? (
          <StateNotice
            compact
            kind={online ? "error" : "offline"}
            title={t("home.dailyDrop.unavailable")}
            actionLabel={t("common.actions.retry")}
            onAction={drop.retry}
          />
        ) : null}
        </HomeDesktopGridSlot>

        {/* Your DJs */}
        <HomeDesktopGridSlot slot="djs">
        {djsOfflineWithoutData ? (
          <StateNotice
            compact
            kind="offline"
            title={t("common.errors.offline")}
            message={t("common.errors.reconnect")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void djsQuery.refetch()}
          />
        ) : djsLoading ? (
          <HomeDjsSkeleton />
        ) : djs && djs.length > 0 && !blockingDjsError ? (
          <TourTarget id="home.djs" onLayout={captureTargetOffset("home.djs")}>
            {djsSection}
          </TourTarget>
        ) : djsSection}
        </HomeDesktopGridSlot>

        <HomeDesktopGridSlot slot="shelves">
        {recentOfflineWithoutData ? (
          <StateNotice
            compact
            kind="offline"
            title={t("common.errors.offline")}
            message={t("common.errors.reconnect")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void recentQuery.refetch()}
          />
        ) : recentLoading ? (
          <ContentShelfSkeleton />
        ) : blockingRecentError ? (
          <StateNotice
            compact
            kind={online ? "error" : "offline"}
            title={t("home.freshUnavailable")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void recentQuery.refetch()}
          />
        ) : freshTracks.length >= 3 ? (
          <>
            <ContentShelf
              title={t("home.freshFrequencies")}
              tracks={freshTracks}
              presentation={layoutMode === "desktop" ? "grid" : "scroll"}
              onPressTrack={(t, i) => playFromShelf(freshTracks, t, i)}
            />
            {recentQuery.isError ? (
              <StateNotice
                compact
                kind={online ? "error" : "offline"}
                title={t("home.freshUnavailable")}
                actionLabel={t("common.actions.retry")}
                onAction={() => void recentQuery.refetch()}
              />
            ) : null}
          </>
        ) : recentQuery.isError ? (
          <StateNotice
            compact
            kind={online ? "error" : "offline"}
            title={t("home.freshUnavailable")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void recentQuery.refetch()}
          />
        ) : recent !== undefined ? (
          <StateNotice
            compact
            kind="empty"
            title={t("home.freshEmpty")}
            actionLabel={t("home.discoverAction")}
            onAction={openDiscover}
          />
        ) : null}

        {contextualOfflineWithoutData ? (
          <StateNotice
            compact
            kind="offline"
            title={t("common.errors.offline")}
            message={t("common.errors.reconnect")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void contextualQuery.refetch()}
          />
        ) : contextualLoading ? (
          <ContentShelfSkeleton />
        ) : blockingContextualError ? (
          <StateNotice
            compact
            kind={online ? "error" : "offline"}
            title={t("home.contextualUnavailable")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void contextualQuery.refetch()}
          />
        ) : contextualTracks.length >= 3 ? (
          <>
            <ContentShelf
              title={contextual?.bucket
                ? t(`home.timeOfDay.${contextual.bucket}.label`)
                : t("home.forYou")}
              tracks={contextualTracks}
              presentation={layoutMode === "desktop" ? "grid" : "scroll"}
              onPressTrack={(t, i) => playFromShelf(contextualTracks, t, i)}
            />
            {contextualQuery.isError ? (
              <StateNotice
                compact
                kind={online ? "error" : "offline"}
                title={t("home.contextualUnavailable")}
                actionLabel={t("common.actions.retry")}
                onAction={() => void contextualQuery.refetch()}
              />
            ) : null}
          </>
        ) : contextualQuery.isError ? (
          <StateNotice
            compact
            kind={online ? "error" : "offline"}
            title={t("home.contextualUnavailable")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void contextualQuery.refetch()}
          />
        ) : contextual !== undefined ? (
          <StateNotice
            compact
            kind="empty"
            title={t("home.contextualEmpty")}
            actionLabel={t("home.discoverAction")}
            onAction={openDiscover}
          />
        ) : null}
        </HomeDesktopGridSlot>

        {/* Personalized Library */}
        <HomeDesktopGridSlot slot="lower">
        <HomeDesktopGridSlot slot="library">
        <View style={styles.section}>
          <Text variant="h2">{t("home.library.title")}</Text>

          {aiMixOfflineWithoutData ? (
            <StateNotice
              compact
              kind="offline"
              title={t("common.errors.offline")}
              message={t("common.errors.reconnect")}
              actionLabel={t("common.actions.retry")}
              onAction={() => void aiMixQuery.refetch()}
            />
          ) : aiMixLoading ? (
            <HomeLibraryRowSkeleton />
          ) : blockingAiMixError ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={t("home.aiMixesUnavailable")}
              actionLabel={t("common.actions.retry")}
              onAction={() => void aiMixQuery.refetch()}
            />
          ) : playableAiMixes.length > 0 ? (
            <>
              <LibraryCard
                cover={`${process.env.EXPO_PUBLIC_MEDIA_BASE}/covers/hero/ai-mixes.jpg?v=1`}
                label={t("home.library.generated")}
                title={t("home.library.aiMixes")}
                onPress={playAIMixes}
                right={
                  <View style={styles.playButton}>
                    <Play size={22} color={theme.colors.onSurface} fill={theme.colors.onSurface} />
                  </View>
                }
              />
              {aiMixQuery.isError ? (
                <StateNotice
                  compact
                  kind={online ? "error" : "offline"}
                  title={t("home.aiMixesUnavailable")}
                  actionLabel={t("common.actions.retry")}
                  onAction={() => void aiMixQuery.refetch()}
                />
              ) : null}
            </>
          ) : aiMixQuery.isError ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={t("home.aiMixesUnavailable")}
              actionLabel={t("common.actions.retry")}
              onAction={() => void aiMixQuery.refetch()}
            />
          ) : aiMix !== undefined ? (
            <StateNotice
              compact
              kind="empty"
              title={t("home.aiMixesEmpty")}
              actionLabel={t("home.discoverAction")}
              onAction={openDiscover}
            />
          ) : null}

          {favoritesOfflineWithoutData ? (
            <StateNotice
              compact
              kind="offline"
              title={t("common.errors.offline")}
              message={t("common.errors.reconnect")}
              actionLabel={t("common.actions.retry")}
              onAction={() => void favoritesQuery.refetch()}
            />
          ) : favoritesLoading ? (
            <HomeLibraryRowSkeleton />
          ) : blockingFavoritesError ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={t("home.favoritesUnavailable")}
              actionLabel={t("common.actions.retry")}
              onAction={() => void favoritesQuery.refetch()}
            />
          ) : favorites && favorites.length > 0 ? (
            <>
              <LibraryCard
                cover={favorites[0]?.album_art_url ?? null}
                label={t("home.library.saved")}
                title={t("home.library.favorites")}
                onPress={() => router.push("/favorites")}
                right={
                  <View style={styles.playButton}>
                    <Play size={22} color={theme.colors.onSurface} fill={theme.colors.onSurface} />
                  </View>
                }
              />
              {favoritesQuery.isError ? (
                <StateNotice
                  compact
                  kind={online ? "error" : "offline"}
                  title={t("home.favoritesUnavailable")}
                  actionLabel={t("common.actions.retry")}
                  onAction={() => void favoritesQuery.refetch()}
                />
              ) : null}
            </>
          ) : favoritesQuery.isError ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={t("home.favoritesUnavailable")}
              actionLabel={t("common.actions.retry")}
              onAction={() => void favoritesQuery.refetch()}
            />
          ) : favorites !== undefined ? (
            <StateNotice
              compact
              kind="empty"
              title={t("home.library.noFavorites")}
              actionLabel={t("home.discoverAction")}
              onAction={openDiscover}
            />
          ) : null}
        </View>
        </HomeDesktopGridSlot>

        <HomeDesktopGridSlot slot="supporting">
        {vibeOfflineWithoutData ? (
          <StateNotice
            compact
            kind="offline"
            title={t("common.errors.offline")}
            message={t("common.errors.reconnect")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void vibeQuery.refetch()}
          />
        ) : vibeLoading ? (
          <HomeVibeSkeleton />
        ) : blockingVibeError ? (
          <StateNotice
            compact
            kind={online ? "error" : "offline"}
            title={t("home.vibeUnavailable")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void vibeQuery.refetch()}
          />
        ) : vibe && vibe.hoursThisWeek > 0 ? (
          <>
            <VibeSpotlightCard
              hours={formatHours(vibe.hoursThisWeek, resolvedLanguage)}
              topGenre={vibe.topGenre}
              streak={vibe.streak}
              onPress={() => router.push("/vibe-check")}
            />
            {vibeQuery.isError ? (
              <StateNotice
                compact
                kind={online ? "error" : "offline"}
                title={t("home.vibeUnavailable")}
                actionLabel={t("common.actions.retry")}
                onAction={() => void vibeQuery.refetch()}
              />
            ) : null}
          </>
        ) : vibeQuery.isError ? (
          <StateNotice
            compact
            kind={online ? "error" : "offline"}
            title={t("home.vibeUnavailable")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void vibeQuery.refetch()}
          />
        ) : vibe !== undefined ? (
          <StateNotice
            compact
            kind="empty"
            title={t("home.vibeEmpty")}
            actionLabel={t("home.discoverAction")}
            onAction={openDiscover}
          />
        ) : null}

        {/* Focus Mode entry */}
        <Pressable
          onPress={() => router.push("/focus-mode")}
          accessibilityRole="button"
          accessibilityLabel={t("home.focus.start")}
          style={({ pressed }) => [
            styles.focusEntry,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.focusOrbSlot}>
            <FocusOrb active size={56} />
          </View>
          <View style={styles.focusText}>
            <Text variant="bodyLg">{t("home.focus.title")}</Text>
            <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6}>
              {t("home.focus.subtitle")}
            </Text>
          </View>
          <ChevronRight size={20} color={theme.colors.onSurfaceVariant} />
        </Pressable>
        </HomeDesktopGridSlot>
        </HomeDesktopGridSlot>
        </HomeDesktopGrid>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.stackLg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.gutter,
  },
  greeting: {
    flex: 1,
    gap: theme.spacing.stackXs,
  },
  focusEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
    padding: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassTint,
    overflow: "hidden",
  },
  focusOrbSlot: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  focusText: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: theme.spacing.stackMd,
  },
  horizontalScroll: {
    marginHorizontal: -theme.spacing.pageMargin,
  },
  horizontalList: {
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.gutter,
  },
  newDJSlot: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    gap: theme.spacing.stackXs,
  },
  newDJCircle: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  newDJLabel: {
    textAlign: "center",
    width: 80,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.glassTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  profileShortcut: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
}));
