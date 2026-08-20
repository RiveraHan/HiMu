import { ScrollView, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { DjAvatarSkeleton, GlassCard, Skeleton } from "@/src/components";

export function HomeHeroSkeleton() {
  return (
    <GlassCard style={styles.hero}>
      <Skeleton width={92} height={12} radius={3} />
      <View style={styles.heroBody}>
        <Skeleton width={64} height={64} radius={9999} />
        <View style={styles.grow}>
          <Skeleton width="44%" height={18} radius={4} />
          <Skeleton width="82%" height={28} radius={6} />
          <Skeleton width="58%" height={18} radius={4} />
        </View>
      </View>
    </GlassCard>
  );
}

export function HomeDjsSkeleton() {
  return (
    <View style={styles.section}>
      <Skeleton width={110} height={30} radius={6} />
      <ScrollView
        horizontal
        scrollEnabled={false}
        style={styles.edgeToEdge}
        contentContainerStyle={styles.horizontal}
      >
        {[0, 1, 2].map((index) => (
          <DjAvatarSkeleton key={index} />
        ))}
      </ScrollView>
    </View>
  );
}

export function HomeLibraryRowSkeleton() {
  return (
    <Skeleton testID="home-library-row-skeleton" height={180} radius={24} />
  );
}

export function HomeVibeSkeleton() {
  return <Skeleton height={176} radius={24} />;
}

const styles = StyleSheet.create((theme) => ({
  hero: { gap: theme.spacing.stackMd },
  heroBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  grow: { flex: 1, gap: theme.spacing.stackSm },
  section: { gap: theme.spacing.stackMd },
  edgeToEdge: { marginHorizontal: -theme.spacing.pageMargin },
  horizontal: {
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.gutter,
  },
}));
