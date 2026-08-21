import {
  GlassCard,
  ScreenHeader,
  ScreenScrollView,
  StateNotice,
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
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useVibeCheck } from "@/src/hooks/use-vibe-check";
import { formatCount, formatHours } from "@/src/utils/format-stats";
import { catalogLabel } from "@/src/i18n/catalog-labels";
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
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function VibeCheckScreen() {
  const { t, i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage === "es" ? "es" : "en";
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const online = useOnlineStatus();
  const vibeQuery = useVibeCheck();
  const djsQuery = useDJs();
  const vibe = vibeQuery.data;
  const djs = djsQuery.data;
  const vibeLoading = isInitialQueryLoading(vibeQuery);
  const djsLoading = isInitialQueryLoading(djsQuery);
  const vibeOfflineWithoutData =
    !online && vibeQuery.fetchStatus === "paused" && vibe === undefined;
  const blockingVibeError = vibeQuery.isError && vibe === undefined;
  const noListening =
    vibe !== undefined &&
    vibe.hoursThisWeek === 0 &&
    vibe.tracksThisWeek === 0;
  const djsOfflineWithoutData =
    !online && djsQuery.fetchStatus === "paused" && djs === undefined;
  const blockingDjsError = djsQuery.isError && djs === undefined;

  return (
    <ScreenScrollView
      style={styles.root}
      canvasVariant="wide"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        kicker={t("playback.vibe.kicker")}
        title={t("playback.vibe.title")}
        subtitle={t("playback.vibe.subtitle")}
      />

      <View
        nativeID="himu-web-core-vibe-dashboard"
        testID="vibe-dashboard"
        style={styles.dashboard}
      >
        <View testID="vibe-insights" style={styles.insights}>
      {vibeOfflineWithoutData ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void vibeQuery.refetch()}
        />
      ) : vibeLoading ? (
        <VibeInsightSkeleton />
      ) : blockingVibeError || vibe === undefined ? (
        <StateNotice
          kind={online ? "error" : "offline"}
          title={t("playback.vibe.unavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void vibeQuery.refetch()}
        />
      ) : noListening ? (
        <>
          <StateNotice
            kind="empty"
            title={t("playback.vibe.empty")}
            actionLabel={t("profile.favorites.discoverAction")}
            onAction={() => router.replace("/(app)/discover")}
          />
          {vibeQuery.isError || !online ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={
                online
                  ? t("playback.vibe.unavailable")
                  : t("common.errors.offline")
              }
              actionLabel={t("common.actions.retry")}
              onAction={() => void vibeQuery.refetch()}
            />
          ) : null}
        </>
      ) : (
        <>
          {/* Hero - Resonance Flow */}
          <GlassCard style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroTitle}>
                <Text variant="bodyLg">{t("playback.vibe.resonanceFlow")}</Text>
                <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.7}>
                  {vibe?.topGenre
                    ? t("playback.vibe.mostlyGenre", {
                        genre: catalogLabel(vibe.topGenre, resolvedLanguage),
                      })
                    : t("playback.vibe.thisWeek")}
                </Text>
              </View>
              <View style={styles.heroNumber}>
                <Text variant="display">
                  {formatHours(vibe?.hoursThisWeek ?? 0, resolvedLanguage)}
                </Text>
                <Text variant="labelCaps" color="onSurfaceVariant">
                  {t("playback.vibe.hours", {
                    count: vibe?.hoursThisWeek ?? 0,
                  })}
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
                    {t("playback.vibe.weekOverWeek", {
                      percent: Math.abs(Math.round(vibe.weekOverWeekPct * 100)),
                    })}
                  </Text>
                </View>
              )}
              <Text
                variant="labelCaps"
                color="onSurfaceVariant"
                opacity={0.7}
              >
                {t("playback.vibe.songs", {
                  count: vibe?.tracksThisWeek ?? 0,
                  formattedCount: formatCount(
                    vibe?.tracksThisWeek ?? 0,
                    resolvedLanguage,
                  ),
                })}
                {" · "}
                {t("playback.vibe.streak", {
                  count: vibe?.streak ?? 0,
                  days: t("playback.vibe.days", { count: vibe?.streak ?? 0 }),
                })}
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
                  label={catalogLabel(slice.genre, resolvedLanguage)}
                />
              ))}
            </View>
          )}

          <TopGenreCard
            icon={<Waves size={20} color={theme.colors.tertiary} />}
            genre={vibe?.topGenre ?? null}
            pct={vibe?.genreMix[0]?.percentage ?? 0}
          />
          {vibeQuery.isError || !online ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={
                online
                  ? t("playback.vibe.unavailable")
                  : t("common.errors.offline")
              }
              actionLabel={t("common.actions.retry")}
              onAction={() => void vibeQuery.refetch()}
            />
          ) : null}
        </>
      )}
        </View>

        <View testID="vibe-ranking" style={styles.ranking}>
      {/* Top Djs Top Agents */}

      {djsOfflineWithoutData ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djsQuery.refetch()}
        />
      ) : djsLoading ? (
        <VibeDjsSkeleton />
      ) : blockingDjsError || djs === undefined ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="labelCaps" color="onSurfaceVariant" style={styles.sectionLabel}>
              {t("playback.vibe.topDjs")}
            </Text>
          </View>
          <StateNotice
            kind={online ? "error" : "offline"}
            title={t("playback.vibe.djsUnavailable")}
            actionLabel={t("common.actions.retry")}
            onAction={() => void djsQuery.refetch()}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              style={styles.sectionLabel}
            >
              {t("playback.vibe.topDjs")}
            </Text>
          </View>
          {djs.length === 0 ? (
            <StateNotice
              kind="empty"
              title={t("playback.vibe.noDjs")}
              actionLabel={t("playback.vibe.goHome")}
              onAction={() => router.replace("/")}
            />
          ) : (
            <GlassCard style={styles.djCard}>
              {djs.slice(0, 3).map((dj, i) => (
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
          )}
          {djsQuery.isError || !online ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={
                online
                  ? t("playback.vibe.djsUnavailable")
                  : t("common.errors.offline")
              }
              actionLabel={t("common.actions.retry")}
              onAction={() => void djsQuery.refetch()}
            />
          ) : null}
        </View>
      )}
        </View>
      </View>
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
  dashboard: {
    flexDirection: { xs: "column", xl: "row" },
    alignItems: "stretch",
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  insights: {
    flex: { xs: 0, xl: 3 },
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  ranking: {
    flex: { xs: 0, xl: 2 },
    gap: theme.spacing.stackLg,
    minWidth: 0,
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
