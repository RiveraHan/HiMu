import {
  GlassCard,
  ScreenHeader,
  ScreenScrollView,
  StatCard,
  TopDjRow,
  TopGenreCard,
  VibeAreaChart,
  VibeDjsSkeleton,
  VibeInsightSkeleton,
} from "@/src/components";
import { Text } from "@/src/components/Text";
import { useDJs } from "@/src/hooks/use-home";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useVibeCheck } from "@/src/hooks/use-vibe-check";
import { formatCount, formatHours } from "@/src/utils/format-stats";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { router } from "expo-router";
import {
  AudioLines,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function VibeCheckScreen() {
  const { i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage ?? "en";
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const vibeQuery = useVibeCheck();
  const djsQuery = useDJs();
  const vibe = vibeQuery.data;
  const djs = djsQuery.data;
  const vibeLoading = isInitialQueryLoading(vibeQuery);
  const djsLoading = isInitialQueryLoading(djsQuery);

  return (
    <ScreenScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        kicker="THIS WEEK"
        title="Vibe Check"
        subtitle="Your sonic evolution this week."
      />

      {vibeLoading ? (
        <VibeInsightSkeleton />
      ) : (
        <>
          {/* Hero - Resonance Flow */}
          <GlassCard style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroTitle}>
                <Text variant="bodyLg">Resonance Flow</Text>
                <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.7}>
                  {vibe?.topGenre ? `Mostly ${vibe.topGenre}` : "This week"}
                </Text>
              </View>
              <View style={styles.heroNumber}>
                <Text variant="display">
                  {formatHours(vibe?.hoursThisWeek ?? 0, resolvedLanguage)}
                </Text>
                <Text variant="labelCaps" color="onSurfaceVariant">
                  HOURS
                </Text>
              </View>
            </View>

            {vibe && <VibeAreaChart data={vibe.week} />}

            <View style={styles.heroFooter}>
              {vibe?.weekOverWeekPct != null && (
                <View style={styles.delta}>
                  {vibe.weekOverWeekPct >= 0 ? (
                    <TrendingUp size={14} color={theme.colors.primary} />
                  ) : (
                    <TrendingDown size={14} color={theme.colors.error} />
                  )}
                  <Text
                    variant="labelCaps"
                    color={vibe.weekOverWeekPct >= 0 ? "primary" : "error"}
                  >
                    {Math.abs(Math.round(vibe.weekOverWeekPct * 100))}% vs last week
                  </Text>
                </View>
              )}
              <Text
                variant="labelCaps"
                color="onSurfaceVariant"
                opacity={0.7}
              >
                {formatCount(vibe?.tracksThisWeek ?? 0, resolvedLanguage)} tracks
                {" · "}
                {vibe?.streak ?? 0}-day streak
              </Text>
            </View>
          </GlassCard>

          {/* Mix genres */}

          {!!vibe && vibe.genreMix.length > 1 && (
            <View style={styles.genreRow}>
              {vibe.genreMix.slice(0, 2).map((slice) => (
                <StatCard
                  key={slice.genre}
                  icon={
                    <AudioLines
                      size={20}
                      color={theme.colors.primaryContainer}
                    />
                  }
                  value={`${Math.round(slice.percentage * 100)}%`}
                  label={slice.genre}
                />
              ))}
            </View>
          )}

          <TopGenreCard
            icon={<Waves size={20} color={theme.colors.tertiary} />}
            genre={vibe?.topGenre ?? null}
            pct={vibe?.genreMix[0]?.percentage ?? 0}
          />
        </>
      )}

      {/* Top Djs Top Agents */}

      {djsLoading ? (
        <VibeDjsSkeleton />
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              style={styles.sectionLabel}
            >
              TOP DJS
            </Text>
          </View>
          <GlassCard style={styles.djCard}>
            {(djs ?? []).slice(0, 3).map((dj, i) => (
              <TopDjRow
                key={dj.id}
                rank={i + 1}
                name={dj.name}
                specialty={dj.genre_specialties?.[0]}
                avatarUrl={dj.avatar_url}
                onPress={() => router.push(`/dj/${dj.id}`)}
              />
            ))}
          </GlassCard>
        </View>
      )}
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
  hero: { gap: theme.spacing.stackMd },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroTitle: {
    gap: theme.spacing.stackXs,
  },
  heroNumber: {
    alignItems: "flex-end",
  },
  heroFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  delta: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackXs,
  },
  genreRow: {
    flexDirection: "row",
    gap: theme.spacing.gutter,
  },
  section: {
    gap: theme.spacing.stackSm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    letterSpacing: 2,
  },
  djCard: {
    gap: theme.spacing.stackMd,
  },
}));
