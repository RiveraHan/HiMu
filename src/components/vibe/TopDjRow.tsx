import { Avatar } from "@/src/components/Avatar";
import { Text } from "@/src/components/Text";
import { Play } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Props = {
  rank: number;
  name: string;
  specialty?: string | null;
  avatarUrl?: string | null;
  onPress?: () => void;
  disabled?: boolean;
};

export function TopDjRow({
  rank,
  name,
  specialty,
  avatarUrl,
  onPress,
  disabled,
}: Props) {
  const { theme } = useUnistyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text variant="labelCaps" color="onSurfaceVariant" style={styles.rank}>
        {String(rank).padStart(2, "0")}
      </Text>
      <Avatar src={avatarUrl} fallback={name} size="md" />
      <View style={styles.text}>
        <Text variant="bodyLg" numberOfLines={1}>
          {name}
        </Text>
        {!!specialty && (
          <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.7}>
            {specialty}
          </Text>
        )}
      </View>
      <Play size={20} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  rank: { width: 22 },
  text: { flex: 1, gap: theme.spacing.stackXs },
  pressed: { opacity: 0.6 },
}));
