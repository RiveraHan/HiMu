import { ScrollView, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { shelfLayout, shelfLayoutBreakpoints } from "@/src/components/home/shelf-layout";
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

export function TrackTileSkeleton({ artworkTestID }: { artworkTestID?: string }) {
  return (
    <View style={styles.trackTileContent}>
      <View testID={artworkTestID} style={styles.trackArtwork}>
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
  return (
    <View style={styles.section}>
      <Skeleton width={190} height={30} radius={6} />
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        testID="content-shelf-skeleton-scroll"
        style={styles.shelfScroll}
        contentContainerStyle={styles.shelf}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            testID={`content-shelf-skeleton-tile-${index}`}
            style={[styles.trackTile, index > 2 && styles.desktopOnly]}
          >
            <TrackTileSkeleton artworkTestID={`content-shelf-skeleton-artwork-${index}`} />
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
  trackTile: {
    width: shelfLayoutBreakpoints.tileWidth,
    flexBasis: shelfLayoutBreakpoints.tileBasis,
    flexGrow: shelfLayoutBreakpoints.tileGrow,
    minWidth: shelfLayoutBreakpoints.tileMinWidth,
    maxWidth: shelfLayoutBreakpoints.tileMaxWidth,
    gap: theme.spacing.stackSm,
  },
  trackTileContent: { gap: theme.spacing.stackSm },
  trackArtwork: {
    width: "100%",
    aspectRatio: 1,
  },
  djAvatar: { width: 80, alignItems: "center", gap: theme.spacing.stackSm },
  section: { gap: theme.spacing.stackMd },
  edgeToEdge: { marginHorizontal: -theme.spacing.pageMargin },
  shelfScroll: {
    marginHorizontal: {
      xs: shelfLayout.compact.scrollMargin === "edge" ? -theme.spacing.pageMargin : 0,
      xl: shelfLayout.desktop.scrollMargin,
    },
  },
  shelf: {
    paddingHorizontal: {
      xs: shelfLayout.compact.horizontalInset === "page" ? theme.spacing.pageMargin : 0,
      xl: shelfLayout.desktop.horizontalInset,
    },
    flexDirection: "row",
    gap: theme.spacing.gutter,
    flexWrap: shelfLayoutBreakpoints.flexWrap,
    width: shelfLayoutBreakpoints.contentWidth,
  },
  desktopOnly: { display: shelfLayoutBreakpoints.extraSkeletonDisplay },
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
