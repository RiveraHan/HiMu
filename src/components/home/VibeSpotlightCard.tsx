import { ChevronRight, Waves } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Text } from "../Text";

type Props = {
  hours: string;
  topGenre: string | null;
  streak: number;
  onPress: () => void;
};

export function VibeSpotlightCard({
  hours,
  topGenre,
  streak,
  onPress,
}: Props) {
  const { theme } = useUnistyles();

  const subtitle = [
    topGenre ? `Mostly ${topGenre}` : null,
    `${streak}-day streak`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open your Vibe Check"
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={styles.iconSlot}>
        <Waves size={22} color={theme.colors.tertiary} />
      </View>
      <View style={styles.body}>
        <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.7}>
          THIS WEEK
        </Text>
        <View style={styles.numberRow}>
          <Text variant="h2">{hours}</Text>
          <Text variant="labelCaps" color="onSurfaceVariant">
            HOURS
          </Text>
        </View>
        <Text
          variant="bodyMd"
          color="onSurfaceVariant"
          opacity={0.6}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={20} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
    padding: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassTint,
    overflow: "hidden",
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  iconSlot: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: 2,
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing.stackXs,
  },
}));
