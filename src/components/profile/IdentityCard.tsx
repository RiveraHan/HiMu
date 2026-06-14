import { View } from "react-native";
import { GlassCard } from "@/src/components/GlassCard";
import { Text } from "@/src/components/Text";
import { AudioLines } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Props = {
  title: string;
  description: string;
};

export function IdentityCard({ title, description }: Props) {
  const { theme } = useUnistyles();
  return (
    <GlassCard style={styles.card}>
      <View style={styles.text}>
        <Text variant="h2" color="tertiary">
          {title}
        </Text>
        <Text variant="bodyMd" color="onSurfaceVariant">
          {description}
        </Text>
      </View>
      <View style={styles.iconCircle}>
        <AudioLines size={28} color={theme.colors.tertiary} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  text: {
    flex: 1,
    gap: theme.spacing.stackXs,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
}));
