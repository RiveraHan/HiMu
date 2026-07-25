import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { GlassCard } from "@/src/components/GlassCard";
import { Skeleton } from "./Skeleton";

export function TrackRowSkeleton() {
  return (
    <View style={styles.trackRow}>
      <Skeleton width={64} height={64} radius={4} />
      <View style={styles.grow}>
        <Skeleton width="72%" height={20} radius={4} />
        <Skeleton width="46%" height={16} radius={4} />
      </View>
    </View>
  );
}

export function TrackTileSkeleton() {
  return (
    <View style={styles.trackTile}>
      <Skeleton height={140} radius={12} />
      <Skeleton width="84%" height={20} radius={4} />
      <Skeleton width="58%" height={16} radius={4} />
    </View>
  );
}

export function DjAvatarSkeleton() {
  return (
    <View style={styles.djAvatar}>
      <Skeleton width={48} height={48} radius={9999} />
      <Skeleton width={64} height={18} radius={4} />
      <Skeleton width={48} height={14} radius={4} />
    </View>
  );
}

export function ContentShelfSkeleton() {
  return (
    <View style={styles.section}>
      <Skeleton width={190} height={30} radius={6} />
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.edgeToEdge}
        contentContainerStyle={styles.shelf}
      >
        {[0, 1, 2].map((index) => (
          <TrackTileSkeleton key={index} />
        ))}
      </ScrollView>
    </View>
  );
}

export function StatCardSkeleton() {
  return (
    <GlassCard style={styles.statCard}>
      <Skeleton width={20} height={20} radius={9999} />
      <Skeleton width={54} height={30} radius={5} />
      <Skeleton width={48} height={12} radius={3} />
    </GlassCard>
  );
}

export function TopDjRowSkeleton() {
  return (
    <View style={styles.topDjRow}>
      <Skeleton width={22} height={12} radius={3} />
      <Skeleton width={48} height={48} radius={9999} />
      <View style={styles.grow}>
        <Skeleton width="58%" height={20} radius={4} />
        <Skeleton width="36%" height={12} radius={3} />
      </View>
      <Skeleton width={20} height={20} radius={9999} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  grow: { flex: 1, gap: theme.spacing.stackXs },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  trackTile: { width: 140, gap: theme.spacing.stackSm },
  djAvatar: { width: 80, alignItems: "center", gap: theme.spacing.stackSm },
  section: { gap: theme.spacing.stackMd },
  edgeToEdge: { marginHorizontal: -theme.spacing.pageMargin },
  shelf: {
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.gutter,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: theme.spacing.stackSm,
    padding: theme.spacing.stackMd,
  },
  topDjRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
}));
