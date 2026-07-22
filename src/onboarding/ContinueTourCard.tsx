import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "@/src/components/Text";

type Props = { onContinue: () => void; onDismiss: () => void };

export function ContinueTourCard({ onContinue, onDismiss }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text variant="labelCaps" color="primary">GUIDED TOUR</Text>
        <Text selectable variant="h2">KEEP EXPLORING HIMU</Text>
        <Text selectable color="onSurfaceVariant">Pick up where you left off.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Continue guided tour"
          accessibilityRole="button"
          onPress={onContinue}
          style={styles.button}
        >
          <Text color="onPrimaryContainer" variant="labelCaps">Continue tour</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Dismiss guided tour"
          accessibilityRole="button"
          onPress={onDismiss}
          style={styles.dismissButton}
        >
          <Text color="onSurfaceVariant" variant="labelCaps">End tour</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    padding: theme.spacing.cardPadding,
    backgroundColor: theme.colors.surfaceContainer,
  },
  copy: { gap: theme.spacing.stackSm },
  actions: { gap: theme.spacing.stackSm },
  button: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    backgroundColor: theme.colors.primaryContainer,
  },
  dismissButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
  },
}));
