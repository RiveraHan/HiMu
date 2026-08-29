import { View } from "react-native";

import { GlassCard } from "@/src/components/GlassCard";
import { Skeleton } from "@/src/components/skeleton/Skeleton";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

export function MusicPreferenceSkeletons() {
  return (
    <View testID="preferences-skeletons" style={styles.root}>
      {[0, 1, 2].map((index) => (
        <GlassCard key={index} testID={`preferences-skeleton-${index}`} style={styles.card}>
          <Skeleton width="42%" height={22} radius={4} />
          <Skeleton width="100%" height={44} radius={8} />
          <Skeleton width={index === 1 ? "88%" : "64%"} height={18} radius={4} />
        </GlassCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { gap: theme.spacing.stackLg },
  card: { gap: theme.spacing.stackMd },
}));
