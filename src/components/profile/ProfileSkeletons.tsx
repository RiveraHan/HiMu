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
    <>
      <View style={styles.statsRow}>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </View>
      <Skeleton height={140} radius={16} />
    </>
  );
}

export function ProfileDjsSkeleton() {
  return (
    <View style={styles.section}>
      <Skeleton width={70} height={12} radius={3} />
      <View style={styles.djGrid}>
        {[0, 1].map((index) => (
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
  statsRow: { flexDirection: "row", gap: theme.spacing.gutter },
  section: { gap: theme.spacing.stackMd },
  djGrid: { flexDirection: "row", gap: theme.spacing.gutter },
  djCard: {
    flex: 1,
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
}));
