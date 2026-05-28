import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Avatar } from "./Avatar";
import { Text } from "./Text";

const LABEL_WIDTH = { md: 80, lg: 104 } as const;

type Props = {
  src?: string | null;
  fallback: string;
  name: string;
  subtitle?: string;
  isLive?: boolean;
  size?: keyof typeof LABEL_WIDTH;
  onPress?: () => void;
  testID?: string;
};

export function DJAvatar({
  src,
  fallback,
  name,
  subtitle,
  isLive = false,
  size = "md",
  onPress,
  testID,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View>
        <Avatar src={src} fallback={fallback} size={size} />
        {isLive && <View style={styles.liveBadge} />}
      </View>
      <Text
        variant="bodyMd"
        numberOfLines={1}
        style={[styles.name, { width: LABEL_WIDTH[size] }]}
      >
        {name}
      </Text>

      {subtitle && (
        <Text
          variant="bodyMd"
          color="onSurfaceVariant"
          opacity={0.6}
          numberOfLines={1}
          style={[styles.subtitle, { width: LABEL_WIDTH[size] }]}
        >
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },

  liveBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.error,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  name: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
}));
