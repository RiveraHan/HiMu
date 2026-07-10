import { usePlayer } from "@/src/audio/use-player";
import {
  Avatar,
  CaptionVoiceButton,
  ContentShelf,
  DJAvatar,
  LibraryCard,
  OnAirHero,
  ScreenScrollView,
  Text,
  VibeSpotlightCard,
} from "@/src/components";
import { FocusOrb } from "@/src/components/focus/FocusOrb";
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
} from "@/src/hooks/use-home";
import { useTabBarPadding } from "@/src/hooks/use-tab-bar-padding";
import { useTasteProfile } from "@/src/hooks/use-taste-profile";
import { useToast } from "@/src/hooks/use-toast";
import { useVibeCheck } from "@/src/hooks/use-vibe-check";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { formatHours } from "@/src/utils/format-stats";
import { weightedShuffle } from "@/src/utils/weighted-shuffle";
import { router } from "expo-router";
import { ChevronRight, Play, Plus } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export default function HomeScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const toast = useToast();
  const { data: djs } = useDJs();
  const { data: liveDJIds } = useLiveDJIds();
  const { data: aiMix } = useAIMixTracks();
  const { data: favorites } = useFavorites();
  const { load } = usePlayer();
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const paddingBottom = useTabBarPadding();

  const ownCount = djs?.filter((d) => d.owner_id === user?.id).length ?? 0;

  const { data: hero } = useOnAirHero();
  const { data: recent } = useRecentTracks();
  const { data: contextual } = useTimeOfDayShelf();
  const { data: vibe } = useVibeCheck();
  const taste = useTasteProfile();
  const drop = useDailyDrop();

  const heroTrackId = hero?.track.id ?? null;

  const freshTracks = useMemo<PlayerTrack[]>(() => {
    if (!recent) return [];
    return recent
      .filter((t) => t.audio_url != null && t.id !== heroTrackId)
      .slice(0, 12)
      .map((t) => ({ ...toPlayerTrack(t), artist: t.dj?.name ?? t.artist }));
  }, [recent, heroTrackId]);

  const contextualTracks = useMemo<PlayerTrack[]>(() => {
    const pool = (contextual?.tracks ?? []).filter(
      (t) => t.audio_url != null && t.id !== heroTrackId,
    );
    return weightedShuffle(pool, taste).slice(0, 12).map(toPlayerTrack);
  }, [contextual, heroTrackId, taste]);

  function getGreeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  function playAIMixes() {
    // Taste-weighted order over the raw rows (they carry genre + mood_tags).
    const pool = weightedShuffle(
      (aiMix ?? []).filter(
        (t): t is typeof t & { audio_url: string } => t.audio_url != null,
      ),
      taste,
    ).map(toPlayerTrack);
    if (!pool.length) return;
    setRepeatMode("all"); // continuous, looping session
    load(pool[0], pool, 0);
  }

  function playHero() {
    if (!hero) return;
    const i = hero.queue.findIndex((t) => t.id === hero.track.id);
    setRepeatMode("all");
    load(hero.track, hero.queue, i < 0 ? 0 : i);
  }

  function playDrop() {
    if (!drop.track) return;
    setRepeatMode("off");
    load(drop.track, [drop.track], 0);
  }

  function playFromShelf(
    tracks: PlayerTrack[],
    track: PlayerTrack,
    index: number,
  ) {
    setRepeatMode("all");
    load(track, tracks, index);
  }

  return (
    <ScreenScrollView
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
              Your sonic environment awaits.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Avatar
              src={user?.user_metadata?.avatar_url}
              fallback={user?.email ?? "U"}
              size="md"
            />
          </Pressable>
        </View>

        {drop.status === "ready" && drop.track && drop.dj ? (
          <OnAirHero
            eyebrow="TODAY'S DROP"
            djName={drop.dj.name}
            avatarUrl={drop.dj.avatar_url}
            genre={drop.dj.genre}
            headline={drop.caption ?? "Fresh, just for you"}
            trackTitle={drop.track.title}
            isLive={false}
            onPlay={playDrop}
            voiceSlot={
              drop.captionAudioUrl ? (
                <CaptionVoiceButton audioUrl={drop.captionAudioUrl} />
              ) : undefined
            }
          />
        ) : drop.status === "pending" && drop.dj ? (
          <OnAirHero
            eyebrow="TODAY'S DROP"
            pending
            djName={drop.dj.name}
            avatarUrl={drop.dj.avatar_url}
            genre={drop.dj.genre}
            headline="Making today's drop…"
            trackTitle=""
            isLive={false}
            onPlay={() => {}}
          />
        ) : drop.status === "failed" && hero ? (
          <OnAirHero
            djName={hero.dj.name}
            avatarUrl={hero.dj.avatar_url}
            genre={hero.dj.genre}
            headline={hero.headline}
            trackTitle={hero.track.title}
            isLive={hero.isLive}
            onPlay={playHero}
          />
        ) : null}

        {/* Your DJs */}
        {djs && djs.length > 0 && (
          <View style={styles.section}>
            <Text variant="h2">Your DJs</Text>
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
                  subtitle={dj.genre_specialties?.[0]}
                  isLive={liveDJIds?.has(dj.id) ?? false}
                  onPress={() => router.push(`/dj/${dj.id}`)}
                />
              ))}
              {/* New DJ slot */}
              <Pressable
                onPress={() => {
                  if (ownCount >= 2) {
                    toast.warning(
                      "DJ limit reached",
                      "You already have 2 DJs. Delete one to create another.",
                    );
                    return;
                  }
                  router.push("/create-dj");
                }}
                style={({ pressed }) => [
                  styles.newDJSlot,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.newDJCircle}>
                  <Svg
                    width={48}
                    height={48}
                    style={StyleSheet.absoluteFillObject}
                  >
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
                <Text
                  variant="bodyMd"
                  numberOfLines={1}
                  style={styles.newDJLabel}
                >
                  New DJ
                </Text>
                <Text
                  variant="bodyMd"
                  color="onSurfaceVariant"
                  opacity={0.6}
                  style={styles.newDJLabel}
                >
                  Create
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

        {freshTracks.length >= 3 && (
          <ContentShelf
            title="Fresh from your DJs"
            tracks={freshTracks}
            onPressTrack={(t, i) => playFromShelf(freshTracks, t, i)}
          />
        )}

        {contextualTracks.length >= 3 && (
          <ContentShelf
            title={contextual?.label ?? "For you"}
            tracks={contextualTracks}
            onPressTrack={(t, i) => playFromShelf(contextualTracks, t, i)}
          />
        )}

        {/* Personalized Library */}
        <View style={styles.section}>
          <Text variant="h2">Personalized Library</Text>

          <LibraryCard
            cover={`${process.env.EXPO_PUBLIC_MEDIA_BASE}/covers/hero/ai-mixes.jpg?v=1`}
            label="GENERATED"
            title="AI Mixes"
            onPress={playAIMixes}
            right={
              <View style={styles.playButton}>
                <Play
                  size={22}
                  color={theme.colors.onSurface}
                  fill={theme.colors.onSurface}
                />
              </View>
            }
          />

          {favorites && (
            <LibraryCard
              cover={favorites?.[0]?.album_art_url ?? null}
              label="SAVED"
              title={
                favorites && favorites.length > 0
                  ? "Favorites"
                  : "No favorites yet"
              }
              onPress={() => router.push("/favorites")}
              right={
                <View style={styles.playButton}>
                  <Play
                    size={22}
                    color={theme.colors.onSurface}
                    fill={theme.colors.onSurface}
                  />
                </View>
              }
            />
          )}
        </View>

        {vibe && vibe.hoursThisWeek > 0 && (
          <VibeSpotlightCard
            hours={formatHours(vibe.hoursThisWeek)}
            topGenre={vibe.topGenre}
            streak={vibe.streak}
            onPress={() => router.push("/vibe-check")}
          />
        )}

        {/* Focus Mode entry */}
        <Pressable
          onPress={() => router.push("/focus-mode")}
          accessibilityRole="button"
          accessibilityLabel="Start a focus session"
          style={({ pressed }) => [
            styles.focusEntry,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.focusOrbSlot}>
            <FocusOrb active size={56} />
          </View>
          <View style={styles.focusText}>
            <Text variant="bodyLg">Focus Mode</Text>
            <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.6}>
              Music + a timer to lock in
            </Text>
          </View>
          <ChevronRight size={20} color={theme.colors.onSurfaceVariant} />
        </Pressable>
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
}));
