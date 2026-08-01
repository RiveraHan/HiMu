import { authApi } from "@/src/api/auth";
import { queryKeys } from "@/src/api/queries";
import { usePlayer } from "@/src/audio/use-player";
import {
  Avatar,
  GlassCard,
  IdentityCard,
  ProfileDjsSkeleton,
  ProfileIdentitySkeleton,
  ProfileStatsSkeleton,
  ScreenScrollView,
  SettingRow,
  StateNotice,
  StatCard,
  Text,
} from "@/src/components";
import { useDJs } from "@/src/hooks/use-home";
import { useCurrentUser } from "@/src/hooks/use-auth";
import {
  useDjsHeard,
  useListeningTotals,
  useProfile,
} from "@/src/hooks/use-profile";
import { useTabBarPadding } from "@/src/hooks/use-tab-bar-padding";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useAppTour } from "@/src/onboarding";
import { formatCount, formatHours } from "@/src/utils/format-stats";
import { getListeningIdentity } from "@/src/utils/listening-identity";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { catalogLabel } from "@/src/i18n/catalog-labels";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronRight,
  CircleStar,
  Clock,
  Compass,
  Crown,
  Disc3,
  Headphones,
  LogOut,
  SlidersHorizontal,
  User,
} from "lucide-react-native";
import { useConfirm } from "@/src/hooks/use-confirm";
import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function ProfileScreen() {
  const user = useCurrentUser();
  const { t, i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage === "es" ? "es" : "en";
  const insets = useSafeAreaInsets();
  const paddingBottom = useTabBarPadding();
  const online = useOnlineStatus();
  const profileQuery = useProfile();
  const statsQuery = useListeningTotals();
  const djsHeardQuery = useDjsHeard();
  const djsQuery = useDJs();
  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const djsHeard = djsHeardQuery.data;
  const djs = djsQuery.data;
  const profileLoading = isInitialQueryLoading(profileQuery);
  const statsLoading =
    isInitialQueryLoading(statsQuery) ||
    isInitialQueryLoading(djsHeardQuery);
  const djsLoading = isInitialQueryLoading(djsQuery);
  const profileOfflineWithoutData = !online && profileQuery.fetchStatus === "paused" && profile === undefined;
  const statsOfflineWithoutData = !online && (
    (statsQuery.fetchStatus === "paused" && stats === undefined) ||
    (djsHeardQuery.fetchStatus === "paused" && djsHeard === undefined)
  );
  const djsOfflineWithoutData = !online && djsQuery.fetchStatus === "paused" && djs === undefined;
  const profileUnresolved = profile === undefined && profileQuery.isPending;
  const blockingProfileError = profileQuery.isError && profile === undefined;
  const blockingStatsError =
    (statsQuery.isError && stats === undefined) ||
    (djsHeardQuery.isError && djsHeard === undefined);
  const blockingDjsError = djsQuery.isError && djs === undefined;
  const hasCachedProfileData = [profile, stats, djsHeard, djs]
    .some((value) => value !== undefined);
  const { theme } = useUnistyles();
  const { flushListeningStats } = usePlayer();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { replayTour } = useAppTour();

  const onReplayTour = () => {
    replayTour();
    router.replace("/");
  };

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.listening(user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.djsHeard(user.id) });
    }, [queryClient, user]),
  );

  const isPro = profile?.subscriptionTier === "premium";
  const identity = getListeningIdentity(stats?.topGenre ?? null);

  const onLogout = async () => {
    const ok = await confirm({
      title: t("profile.logout"),
      message: t("profile.logoutQuestion"),
      confirmLabel: t("profile.logout"),
      destructive: true,
    });
    if (!ok) return;
    await flushListeningStats(); // save the session's progress
    await authApi.signOut(); // PlayerProvider pauses and resets when the session ends
  };

  return (
    <ScreenScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
    >
      {!online && hasCachedProfileData ? (
        <StateNotice
          compact
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
        />
      ) : null}

      {/*Perfil Header*/}
      {profileOfflineWithoutData ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void profileQuery.refetch()}
        />
      ) : profileLoading || profileUnresolved ? (
        <ProfileIdentitySkeleton />
      ) : blockingProfileError ? (
        <StateNotice
          kind={online ? "error" : "offline"}
          title={t("profile.profileUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void profileQuery.refetch()}
        />
      ) : (
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <Avatar
              src={profile?.avatarUrl}
              fallback={profile?.name ?? t("profile.listener")}
              size="2xl"
            />
            <View style={styles.tierBadge}>
              {isPro && (
                <CircleStar size={14} color={theme.colors.onPrimaryContainer} />
              )}
              <Text variant="labelCaps" color="onPrimaryContainer">
                {isPro
                  ? t("profile.tier.proCaps")
                  : t("profile.tier.freeCaps")}
              </Text>
            </View>
          </View>
          <View style={styles.headerText}>
            <Text variant="h1" numberOfLines={1}>
              {profile?.name ?? t("profile.listener")}
            </Text>
            {!!profile?.username && (
              <Text variant="bodyMd" numberOfLines={1} color="onSurfaceVariant">
                @{profile.username}
              </Text>
            )}
          </View>
        </View>
      )}

      {/*Stats → Vibe Check*/}
      {statsOfflineWithoutData ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => {
            if (stats === undefined) void statsQuery.refetch();
            if (djsHeard === undefined) void djsHeardQuery.refetch();
          }}
        />
      ) : statsLoading ? (
        <ProfileStatsSkeleton />
      ) : blockingStatsError ? (
        <StateNotice
          kind={online ? "error" : "offline"}
          title={t("profile.statsUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => {
            if (statsQuery.isError) void statsQuery.refetch();
            if (djsHeardQuery.isError) void djsHeardQuery.refetch();
          }}
        />
      ) : (
        <>
          <Pressable
            onPress={() => router.push("/vibe-check")}
            accessibilityRole="button"
            accessibilityLabel={t("profile.openVibeCheck")}
            style={({ pressed }) => [styles.section, pressed && styles.pressed]}
          >
            <View style={styles.sectionHeader}>
              <Text
                variant="labelCaps"
                color="onSurfaceVariant"
                style={styles.sectionLabel}
              >
                {t("profile.vibeCheck")}
              </Text>
              <ChevronRight size={16} color={theme.colors.onSurfaceVariant} />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                icon={<Clock size={20} color={theme.colors.tertiary} />}
                value={formatHours(stats?.hours ?? 0, resolvedLanguage)}
                label={t("profile.hours")}
              />
              <StatCard
                icon={<Disc3 size={20} color={theme.colors.primary} />}
                value={formatCount(stats?.tracks ?? 0, resolvedLanguage)}
                label={t("profile.tracks")}
              />
              <StatCard
                icon={<Headphones size={20} color={theme.colors.error} />}
                value={formatCount(djsHeard ?? 0, resolvedLanguage)}
                label={t("profile.djs")}
              />
            </View>
          </Pressable>

          {/*Listening Identity*/}
          <View style={styles.section}>
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              style={styles.sectionLabel}
            >
              {t("profile.listeningIdentity")}
            </Text>
            <IdentityCard
              title={t(`profile.identities.${identity.id}.title`)}
              description={t(`profile.identities.${identity.id}.description`)}
            />
          </View>
          {statsQuery.isError || djsHeardQuery.isError ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={t("profile.statsUnavailable")}
              actionLabel={t("common.actions.retry")}
              onAction={() => {
                if (statsQuery.isError) void statsQuery.refetch();
                if (djsHeardQuery.isError) void djsHeardQuery.refetch();
              }}
            />
          ) : null}
        </>
      )}

      {/*Top DJs*/}
      {djsOfflineWithoutData ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djsQuery.refetch()}
        />
      ) : djsLoading ? (
        <ProfileDjsSkeleton />
      ) : blockingDjsError ? (
        <StateNotice
          kind={online ? "error" : "offline"}
          title={t("profile.djsUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djsQuery.refetch()}
        />
      ) : djs && djs.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              style={styles.sectionLabel}
            >
              {t("profile.yourDjs")}
            </Text>
          </View>
          <View style={styles.djGrid}>
            {djs.map((dj) => (
              <Pressable
                key={dj.id}
                onPress={() => router.push(`/dj/${dj.id}`)}
                style={({ pressed }) => [
                  styles.djCardWrap,
                  pressed && styles.pressed,
                ]}
              >
                <GlassCard style={styles.djCard}>
                  <Avatar src={dj.avatar_url} size="lg" fallback={dj.name} />
                  <Text variant="bodyMd" numberOfLines={1}>
                    {dj.name}
                  </Text>
                  <Text
                    variant="labelCaps"
                    color="onSurfaceVariant"
                    opacity={0.6}
                  >
                    {dj.genre_specialties?.[0]
                      ? catalogLabel(
                          dj.genre_specialties[0],
                          resolvedLanguage,
                        ).toUpperCase()
                      : null}
                  </Text>
                </GlassCard>
              </Pressable>
            ))}
          </View>
          {djsQuery.isError ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={t("profile.djsUnavailable")}
              actionLabel={t("common.actions.retry")}
              onAction={() => void djsQuery.refetch()}
            />
          ) : null}
        </View>
      ) : djsQuery.isError ? (
        <StateNotice
          kind={online ? "error" : "offline"}
          title={t("profile.djsUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djsQuery.refetch()}
        />
      ) : djs !== undefined ? (
        <View style={styles.section}>
          <Text variant="labelCaps" color="onSurfaceVariant" style={styles.sectionLabel}>
            {t("profile.yourDjs")}
          </Text>
          <StateNotice
            compact
            kind="empty"
            title={t("profile.yourDjs")}
            actionLabel={t("profile.createDjAction")}
            onAction={() => router.push("/create-dj")}
          />
        </View>
      ) : null}

      {/*Prefenrences*/}
      <View style={styles.section}>
          <Text
            variant="labelCaps"
            color="onSurfaceVariant"
            style={styles.sectionLabel}
          >
            {t("profile.preferences")}
          </Text>
          <View style={styles.prefList}>
            <SettingRow
              icon={<User size={20} color={theme.colors.onSurfaceVariant} />}
              label={t("profile.accountDetails")}
              onPress={() => router.push("/account-settings")}
            />
            <SettingRow
              icon={
                <SlidersHorizontal
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
              }
              label={t("profile.musicPreferences")}
              onPress={() => router.push("/preferences")}
            />
            {profile ? (
              <SettingRow
                icon={<Crown size={20} color={theme.colors.tertiary} />}
                label={t("profile.subscription")}
                right={
                  <Text
                    variant="bodyMd"
                    color={isPro ? "tertiary" : "onSurfaceVariant"}
                  >
                    {isPro ? t("profile.tier.pro") : t("profile.tier.free")}
                  </Text>
                }
              />
            ) : null}
            <SettingRow
              icon={<Compass size={20} color={theme.colors.onSurfaceVariant} />}
              label={t("profile.replayTour")}
              onPress={onReplayTour}
            />
            <SettingRow
              icon={<LogOut size={20} color={theme.colors.error} />}
              label={t("profile.logout")}
              destructive
              onPress={onLogout}
            />
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
  header: {
    alignItems: "center",
    gap: theme.spacing.stackMd,
  },
  avatarWrap: {
    borderRadius: theme.borderRadius.full,
    boxShadow: "0 0 40px rgba(182,122,241,0.2)",
  },
  tierBadge: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackXs,
    paddingHorizontal: theme.spacing.stackMd - 4,
    paddingVertical: theme.spacing.stackXs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },

  headerText: {
    alignItems: "center",
    gap: theme.spacing.stackXs,
  },
  statsRow: {
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

  djGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.gutter,
  },

  djCardWrap: {
    flexGrow: 1,
    flexBasis: "45%",
  },
  djCard: {
    alignItems: "center",
    gap: theme.spacing.stackSm,
    padding: theme.spacing.stackMd,
  },
  prefList: {
    gap: theme.spacing.stackSm,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
}));
