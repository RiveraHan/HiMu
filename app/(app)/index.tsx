import { usePlayer } from "@/src/audio/use-player";
import {
  Avatar,
  DJAvatar,
  IconButton,
  LibraryCard,
  Text,
} from "@/src/components";
import { useCurrentUser } from "@/src/hooks/use-auth";
import {
  useDJs,
  useFavoritesPreview,
  useLiveDJIds,
  useRecommendedTracks,
} from "@/src/hooks/use-home";
import { useTabBarPadding } from "@/src/hooks/use-tab-bar-padding";
import { PlayerTrack } from "@/src/stores/player-store";
import { Image } from "expo-image";
import { Play, Plus, Settings } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export default function HomeScreen() {
  const { theme } = useUnistyles();
  const user = useCurrentUser();
  const { data: djs } = useDJs();
  const { data: liveDJIds } = useLiveDJIds();
  const { data: favorites } = useFavoritesPreview();
  const { data: recommended } = useRecommendedTracks();
  const { load } = usePlayer();
  const paddingBottom = useTabBarPadding();

  function getGreeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  function playAIMixes() {
    const queue: PlayerTrack[] = (recommended ?? [])
      .filter((t): t is typeof t & { audio_url: string } => t.audio_url != null)
      .map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        audio_url: t.audio_url,
        album_art_url: t.album_art_url,
        duration: t.duration,
        genre: t.genre,
      }));
    if (!queue.length) return;
    load(queue[0], queue, 0);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSide} />

          <Text variant="labelCaps" style={styles.headerTitle}>
            HIMU
          </Text>

          <View style={[styles.headerSide, styles.headerRight]}>
            <Pressable
              onPress={() => {}}
              accessibilityLabel="Profile"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Avatar
                src={user?.user_metadata?.avatar_url}
                fallback={user?.email ?? "U"}
                size="sm"
              />
            </Pressable>
            <IconButton
              icon={
                <Settings size={22} color={theme.colors.onSurfaceVariant} />
              }
              onPress={() => {}}
              accessibilityLabel="Settings"
              size="sm"
            />
          </View>
        </View>

        {/* Greeting */}
        <View style={styles.greeting}>
          <Text variant="h1">{getGreeting()}</Text>
          <Text variant="bodyLg" color="onSurfaceVariant" opacity={0.6}>
            Your sonic environment awaits.
          </Text>
        </View>

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
                  onPress={() => {}}
                />
              ))}
              {/* New DJ slot */}
              <Pressable
                onPress={() => {}}
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

        {/* Personalized Library */}
        <View style={styles.section}>
          <Text variant="h2">Personalized Library</Text>

          <LibraryCard
            cover="https://picsum.photos/800/400?random=70"
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

          <LibraryCard
            cover="https://picsum.photos/800/400?random=71"
            label="CURATED"
            title="Favorites"
            onPress={() => {}}
            right={
              favorites && favorites.count > 0 ? (
                <View style={styles.favoritesRight}>
                  <View style={styles.avatarStack}>
                    {favorites.covers.map((cover, i) => (
                      <Image
                        key={cover}
                        source={cover}
                        style={[
                          styles.stackAvatar,
                          i > 0 && styles.stackOverlap,
                        ]}
                        contentFit="cover"
                      />
                    ))}
                  </View>
                  <Text variant="labelCaps" style={styles.countBadge}>
                    +{favorites.count}
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.pageMargin,
    paddingTop: theme.spacing.stackLg * 2,
    gap: theme.spacing.stackLg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerSide: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.stackSm,
  },
  headerTitle: {
    letterSpacing: 4,
  },
  greeting: {
    gap: theme.spacing.stackXs,
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
  favoritesRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  avatarStack: {
    flexDirection: "row",
  },
  stackAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  stackOverlap: {
    marginLeft: -12,
  },
  countBadge: {
    fontVariant: ["tabular-nums"],
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
}));
