import { View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { GlassCard } from "@/src/components/GlassCard";
import { StatCardSkeleton } from "@/src/components/skeleton/ContentSkeletons";
import { Skeleton } from "@/src/components/skeleton/Skeleton";

export function ProfileIdentitySkeleton() {
  return (
    <View style={styles.identity}>
      <Skeleton width={128} height={128} radius={9999} />
      <Skeleton width={176} height={38} radius={8} />
      <Skeleton width={104} height={20} radius={4} />
    </View>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <View testID="profile-stats-skeleton" style={styles.statsDashboard}>
      <View style={styles.statsColumn}>
        <View style={styles.statsRow}>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </View>
      </View>
      <View style={styles.identityCard}>
        <Skeleton height={140} radius={16} />
      </View>
    </View>
  );
}

export function ProfileDjsSkeleton() {
  return (
    <View style={styles.section}>
      <Skeleton width={70} height={12} radius={3} />
      <View testID="profile-djs-skeleton-grid" style={styles.djGrid}>
        {[0, 1, 2, 3].map((index) => (
          <GlassCard key={index} style={styles.djCard}>
            <Skeleton width={64} height={64} radius={9999} />
            <Skeleton width="64%" height={20} radius={4} />
            <Skeleton width="44%" height={12} radius={3} />
          </GlassCard>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  identity: { alignItems: "center", gap: theme.spacing.stackMd },
  statsDashboard: {
    flexDirection: { xs: "column", xl: "row" },
    gap: theme.spacing.stackLg,
  },
  statsColumn: {
    flex: { xs: 0, xl: 3 },
    minWidth: 0,
  },
  identityCard: {
    flex: { xs: 0, xl: 2 },
    minWidth: 0,
  },
  statsRow: { flexDirection: "row", gap: theme.spacing.gutter },
  section: { gap: theme.spacing.stackMd },
  djGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.gutter },
  djCard: {
    flexGrow: 1,
    flexBasis: { xs: "45%", xl: "31.5%", xxl: "23.5%" },
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
}));
