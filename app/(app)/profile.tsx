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
  StatCard,
  Text,
} from "@/src/components";
import { useDJs } from "@/src/hooks/use-home";
import {
  useDjsHeard,
  useListeningTotals,
  useProfile,
} from "@/src/hooks/use-profile";
import { useTabBarPadding } from "@/src/hooks/use-tab-bar-padding";
import { useAppTour } from "@/src/onboarding";
import { formatCount, formatHours } from "@/src/utils/format-stats";
import { getListeningIdentity } from "@/src/utils/listening-identity";
import { isInitialQueryLoading } from "@/src/utils/query-state";
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const paddingBottom = useTabBarPadding();
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
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.listening });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.djsHeard });
    }, [queryClient]),
  );

  const isPro = profile?.subscriptionTier === "premium";
  const identity = getListeningIdentity(stats?.topGenre ?? null);

  const onLogout = async () => {
    const ok = await confirm({
      title: "Logout",
      message: "Are you sure you want to logout?",
      confirmLabel: "Logout",
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
      {/*Perfil Header*/}
      {profileLoading ? (
        <ProfileIdentitySkeleton />
      ) : (
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <Avatar
              src={profile?.avatarUrl}
              fallback={profile?.name ?? "U"}
              size="2xl"
            />
            <View style={styles.tierBadge}>
              {isPro && (
                <CircleStar size={14} color={theme.colors.onPrimaryContainer} />
              )}
              <Text variant="labelCaps" color="onPrimaryContainer">
                {isPro ? "PRO" : "FREE"}
              </Text>
            </View>
          </View>
          <View style={styles.headerText}>
            <Text variant="h1" numberOfLines={1}>
              {profile?.name ?? "Anonymous"}
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
      {statsLoading ? (
        <ProfileStatsSkeleton />
      ) : (
        <>
          <Pressable
            onPress={() => router.push("/vibe-check")}
            accessibilityRole="button"
            accessibilityLabel="Open Vibe Check"
            style={({ pressed }) => [styles.section, pressed && styles.pressed]}
          >
            <View style={styles.sectionHeader}>
              <Text
                variant="labelCaps"
                color="onSurfaceVariant"
                style={styles.sectionLabel}
              >
                VIBE CHECK
              </Text>
              <ChevronRight size={16} color={theme.colors.onSurfaceVariant} />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                icon={<Clock size={20} color={theme.colors.tertiary} />}
                value={formatHours(stats?.hours ?? 0)}
                label="HOURS"
              />
              <StatCard
                icon={<Disc3 size={20} color={theme.colors.primary} />}
                value={formatCount(stats?.tracks ?? 0)}
                label="TRACKS"
              />
              <StatCard
                icon={<Headphones size={20} color={theme.colors.error} />}
                value={formatCount(djsHeard ?? 0)}
                label="DJS"
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
              LISTENING IDENTITY
            </Text>
            <IdentityCard
              title={identity.title}
              description={identity.description}
            />
          </View>
        </>
      )}

      {/*Top DJs*/}
      {djsLoading ? (
        <ProfileDjsSkeleton />
      ) : djs && djs.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              variant="labelCaps"
              color="onSurfaceVariant"
              style={styles.sectionLabel}
            >
              YOUR DJS
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
                    {dj.genre_specialties?.[0]?.toUpperCase()}
                  </Text>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/*Prefenrences*/}
      <View style={styles.section}>
          <Text
            variant="labelCaps"
            color="onSurfaceVariant"
            style={styles.sectionLabel}
          >
            PREFERENCES
          </Text>
          <View style={styles.prefList}>
            <SettingRow
              icon={<User size={20} color={theme.colors.onSurfaceVariant} />}
              label="Account Details"
              onPress={() => router.push("/account-settings")}
            />
            <SettingRow
              icon={
                <SlidersHorizontal
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
              }
              label="Music Preferences"
              onPress={() => router.push("/preferences")}
            />
            <SettingRow
              icon={<Crown size={20} color={theme.colors.tertiary} />}
              label="Subscription"
              right={
                <Text
                  variant="bodyMd"
                  color={isPro ? "tertiary" : "onSurfaceVariant"}
                >
                  {isPro ? "Pro" : "Free"}
                </Text>
              }
            />
            <SettingRow
              icon={<Compass size={20} color={theme.colors.onSurfaceVariant} />}
              label="Replay product tour"
              onPress={onReplayTour}
            />
            <SettingRow
              icon={<LogOut size={20} color={theme.colors.error} />}
              label="Logout"
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
