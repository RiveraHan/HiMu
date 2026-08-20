import { View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { GlassCard } from "@/src/components/GlassCard";
import {
  StatCardSkeleton,
  TopDjRowSkeleton,
} from "@/src/components/skeleton/ContentSkeletons";
import { Skeleton } from "@/src/components/skeleton/Skeleton";

export function VibeInsightSkeleton() {
  return (
    <>
      <GlassCard style={styles.hero}>
        <View style={styles.spaceBetween}>
          <View style={styles.stack}>
            <Skeleton width={128} height={22} radius={4} />
            <Skeleton width={82} height={18} radius={4} />
          </View>
          <Skeleton width={76} height={48} radius={8} />
        </View>
        <Skeleton height={150} radius={12} />
        <Skeleton width="74%" height={14} radius={3} />
      </GlassCard>
      <View style={styles.row}>
        <StatCardSkeleton />
        <StatCardSkeleton />
      </View>
      <Skeleton height={144} radius={16} />
    </>
  );
}

export function VibeDjsSkeleton() {
  return (
    <View style={styles.section}>
      <Skeleton width={68} height={12} radius={3} />
      <GlassCard style={styles.rows}>
        {[0, 1, 2].map((index) => (
          <TopDjRowSkeleton key={index} />
        ))}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: { gap: theme.spacing.stackMd },
  spaceBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stack: { gap: theme.spacing.stackXs },
  row: { flexDirection: "row", gap: theme.spacing.gutter },
  section: { gap: theme.spacing.stackSm },
  rows: { gap: theme.spacing.stackMd },
}));
