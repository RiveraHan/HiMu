import { Skeleton } from "@/src/components/skeleton/Skeleton";
import { View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

export function TrainDjSkeleton() {
  return (
    <View style={styles.root} testID="train-dj-skeleton">
      <View style={styles.section}>
        <Skeleton width={88} height={14} radius={4} testID="header-copy-skeleton" />
        <Skeleton width="72%" height={16} radius={4} testID="header-copy-skeleton" />
        <View style={styles.portraitRow}>
          <Skeleton width={96} height={96} radius={9999} testID="portrait-skeleton" />
          <Skeleton height={44} radius={9999} style={styles.portraitAction} />
        </View>
      </View>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.traitRow} testID="trait-row-skeleton">
          <Skeleton width={row === 0 ? 96 : 72} height={14} radius={4} />
          <Skeleton height={48} radius={16} />
        </View>
      ))}
      <Skeleton height={52} radius={9999} testID="submit-skeleton" />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { gap: theme.spacing.stackLg },
  section: { gap: theme.spacing.stackSm },
  portraitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  portraitAction: { flex: 1 },
  traitRow: { gap: theme.spacing.stackSm },
}));
