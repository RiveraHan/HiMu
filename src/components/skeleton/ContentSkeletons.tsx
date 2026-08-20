import { ScrollView, useWindowDimensions, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { resolveLayoutMode } from "@/src/theme/layout";
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

export function TrackTileSkeleton({ isDesktop = false }: { isDesktop?: boolean }) {
  return (
    <View style={styles.trackTileContent}>
      <View style={styles.trackArtwork(isDesktop)}>
        <Skeleton height="100%" radius={12} />
      </View>
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
  const { width } = useWindowDimensions();
  const isDesktop = resolveLayoutMode(width) === "desktop";

  return (
    <View style={styles.section}>
      <Skeleton width={190} height={30} radius={6} />
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        testID="content-shelf-skeleton-scroll"
        style={styles.shelfScroll(isDesktop)}
        contentContainerStyle={styles.shelf(isDesktop)}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            testID={`content-shelf-skeleton-tile-${index}`}
            style={[styles.trackTile(isDesktop), index > 2 && styles.desktopOnly(isDesktop)]}
          >
            <TrackTileSkeleton isDesktop={isDesktop} />
          </View>
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
  trackTile: (isDesktop: boolean) => ({
    width: isDesktop ? undefined : 140,
    flexBasis: isDesktop ? 180 : 140,
    flexGrow: isDesktop ? 1 : 0,
    minWidth: isDesktop ? 180 : undefined,
    maxWidth: isDesktop ? 240 : undefined,
    gap: theme.spacing.stackSm,
  }),
  trackTileContent: { gap: theme.spacing.stackSm },
  trackArtwork: (isDesktop: boolean) => ({ height: isDesktop ? 180 : 140 }),
  djAvatar: { width: 80, alignItems: "center", gap: theme.spacing.stackSm },
  section: { gap: theme.spacing.stackMd },
  edgeToEdge: { marginHorizontal: -theme.spacing.pageMargin },
  shelfScroll: (isDesktop: boolean) => ({
    marginHorizontal: isDesktop ? 0 : -theme.spacing.pageMargin,
  }),
  shelf: (isDesktop: boolean) => ({
    paddingHorizontal: isDesktop ? 0 : theme.spacing.pageMargin,
    flexDirection: "row",
    gap: theme.spacing.gutter,
    flexWrap: isDesktop ? "wrap" : "nowrap",
    width: isDesktop ? "100%" : undefined,
  }),
  desktopOnly: (isDesktop: boolean) => ({ display: isDesktop ? "flex" : "none" }),
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
