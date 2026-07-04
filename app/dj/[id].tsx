import { getEdgeErrorCode } from "@/src/api/edge-errors";
import { queryKeys } from "@/src/api/queries";
import { usePlayer } from "@/src/audio/use-player";
import {
  DjHero,
  GeneratingTrackCard,
  GlassInput,
  StatCard,
  Tag,
  Text,
  TrackCard,
} from "@/src/components";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useDeleteDJ } from "@/src/hooks/use-delete-dj";
import { useDJ, useDJTracks } from "@/src/hooks/use-dj";
import { useGenerateMix } from "@/src/hooks/use-generate-mix";
import { useLiveDJIds } from "@/src/hooks/use-home";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  AudioLines,
  ChevronLeft,
  Music2,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export default function DJProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  const { data: dj, isLoading } = useDJ(id);
  const { data: tracks } = useDJTracks(id);
  const { data: liveIds } = useLiveDJIds();
  const { load } = usePlayer();
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const queryClient = useQueryClient();

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
      Alert.alert(
        "Generation failed",
        "The mix couldn't be generated — your daily quota wasn't used. Try again.",
      );
      resetGen();
    }
  }, [genStatus, generatedTrack, load, resetGen, queryClient]);

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
          Alert.alert(
            "Couldn't start the mix",
            code === "daily_quota_reached"
              ? "Daily mix limit reached (10). Try again tomorrow."
              : code === "dj_not_allowed"
                ? "You can't generate with this DJ."
                : "Something went wrong. Please try again.",
          );
        },
      },
    );
  }

  const onDeletePress = () => {
    if (!dj) return;
    Alert.alert(
      "Delete DJ",
      `This will delete ${dj.name} and its ${tracks?.length ?? 0} tracks.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteDJ(
              { djId: id },
              {
                onSuccess: () => router.back(),
                onError: () =>
                  Alert.alert(
                    "Delete failed",
                    "Couldn't delete the DJ. Try again.",
                  ),
              },
            ),
        },
      ],
    );
  };

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.canGoBack() && router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
      >
        <ChevronLeft size={24} color={theme.colors.onSurface} />
      </Pressable>
      {isOwner && (
        <Pressable
          onPress={onDeletePress}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel="Delete DJ"
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Trash2 size={20} color={theme.colors.error} />
        </Pressable>
      )}
    </View>
  );

  if (isLoading) {
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
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </View>
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
          <Text variant="h2">DJ not found</Text>
          <Text variant="bodyMd" color="onSurfaceVariant">
            This DJ doesn’t exist or was removed.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom:
            insets.bottom +
            theme.spacing.stackLg +
            (currentId ? 64 + theme.spacing.stackSm : 0),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.body,
            { paddingTop: insets.top + theme.spacing.stackMd },
          ]}
        >
          {header}

          <DjHero
            name={dj.name}
            avatarUrl={dj.avatar_url}
            isLive={!!liveIds?.has(id)}
            tagline={
              isOwner
                ? "YOUR DJ"
                : dj.is_premium
                  ? "Global Resident"
                  : undefined
            }
          />

          {/* Stats remap */}
          <View style={styles.statsRow}>
            <StatCard
              icon={
                <AudioLines size={20} color={theme.colors.primaryContainer} />
              }
              value={String(tracks?.length ?? 0)}
              label="TRACKS"
            />
            <StatCard
              icon={<Music2 size={20} color={theme.colors.tertiary} />}
              value={String(dj.genre_specialties?.length ?? 0)}
              label="GENRES"
            />
          </View>

          {/* Own lyrics: only for your vocal DJs (server re-validates) */}
          {isOwner && isVocal && (
            <GlassInput
              label="YOUR OWN LYRICS (OPTIONAL)"
              hint="Original lyrics only — no copyrighted songs."
              placeholder="Write the lyrics your DJ should sing…"
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
            accessibilityLabel="Generate a new mix"
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
                  GENERATING…
                </Text>
              </>
            ) : (
              <>
                <Sparkles size={20} color={theme.colors.onPrimary} />
                <Text variant="labelCaps" color="onPrimary">
                  Generate new mix
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
                SONIC PHILOSOPHY
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
                CURATED GENRES
              </Text>
              <View style={styles.tagWrap}>
                {dj.genre_specialties.map((g) => (
                  <Tag key={g} label={g} />
                ))}
              </View>
            </View>
          )}

          {/* Tracks */}
          <View style={styles.section}>
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              style={styles.sectionLabel}
            >
              TRACKS
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
              <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.7}>
                No tracks yet.
              </Text>
            )}
          </View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.glassTint,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  pressed: { opacity: 0.6 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
    padding: theme.spacing.pageMargin,
  },
}));
