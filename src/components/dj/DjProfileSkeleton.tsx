import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import {
  StatCardSkeleton,
  TrackRowSkeleton,
} from "@/src/components/skeleton/ContentSkeletons";
import { Skeleton } from "@/src/components/skeleton/Skeleton";

export function DjTracksSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.section}>
      <Skeleton width={58} height={12} radius={3} />
      <View style={styles.trackList}>
        {Array.from({ length: count }, (_, index) => (
          <TrackRowSkeleton key={index} />
        ))}
      </View>
    </View>
  );
}

export function DjProfileSkeleton({
  header,
  paddingTop,
  paddingBottom,
}: {
  header: ReactNode;
  paddingTop: number;
  paddingBottom: number;
}) {
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.body, { paddingTop }]}>
          <View style={styles.header}>{header}</View>
          <View testID="dj-profile-hero-shell" style={styles.heroShell}>
            <Skeleton
              testID="dj-profile-hero-background"
              width="100%"
              height={380}
              radius={16}
              style={StyleSheet.absoluteFillObject}
            />
            <View testID="dj-profile-hero-overlay" style={styles.heroOverlay}>
              <Skeleton width={96} height={12} radius={3} />
              <Skeleton width="58%" height={38} radius={8} />
            </View>
          </View>
          <View style={styles.statsRow}>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </View>
          <Skeleton height={112} radius={16} />
          <Skeleton height={80} radius={16} />
          <DjTracksSkeleton />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  body: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: theme.spacing.pageMargin,
    alignItems: "center",
    gap: theme.spacing.stackLg,
  },
  header: { alignSelf: "stretch" },
  heroShell: {
    alignSelf: "stretch",
    height: 380,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  heroOverlay: {
    gap: theme.spacing.stackSm,
    padding: theme.spacing.pageMargin,
  },
  statsRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: theme.spacing.gutter,
  },
  section: { alignSelf: "stretch", gap: theme.spacing.stackMd },
  trackList: { gap: theme.spacing.stackMd },
}));
