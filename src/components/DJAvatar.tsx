import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Avatar } from "./Avatar";
import { Text } from "./Text";
import { Lock } from "lucide-react-native";

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
  isPrivate?: boolean;
  privateLabel?: string;
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
  isPrivate = false,
  privateLabel,
}: Props) {
  const { theme } = useUnistyles();
  const accessibilityLabel = [
    name,
    isLive ? "live" : null,
    isPrivate ? privateLabel : null,
  ]
    .filter(Boolean)
    .join(", ");
  const content = (
    <>
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
      {isPrivate && privateLabel ? (
        <View style={styles.privateBadge}>
          <Lock size={12} color={theme.colors.onSurfaceVariant} />
          <Text variant="labelCaps" color="onSurfaceVariant">
            {privateLabel}
          </Text>
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible={isPrivate}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={styles.root}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    minWidth: 44,
    minHeight: 44,
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
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackXs,
  },
}));
