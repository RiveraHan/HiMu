import { usePlayer } from "@/src/audio/use-player";
import { DjHero, StatCard, Tag, Text, TrackCard } from "@/src/components";
import { useDJ, useDJTracks } from "@/src/hooks/use-dj";
import { useLiveDJIds } from "@/src/hooks/use-home";
import { PlayerTrack, usePlayerStore } from "@/src/stores/player-store";
import { router, useLocalSearchParams } from "expo-router";
import { AudioLines, ChevronLeft, Music2 } from "lucide-react-native";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
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
            tagline={dj.is_premium ? "Global Resident" : undefined}
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
            {queue.length > 0 ? (
              <View style={styles.trackList}>
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
  header: { flexDirection: "row" },
  statsRow: { flexDirection: "row", gap: theme.spacing.gutter },
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
