import { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../Text";
import { ChevronRight } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Props = {
  icon: ReactNode;
  label: string;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
};

export function SettingRow({
  icon,
  label,
  right,
  onPress,
  destructive,
}: Props) {
  const { theme } = useUnistyles();

  const content = (
    <>
      {icon}
      <Text
        variant="bodyMd"
        color={destructive ? "error" : "onSurface"}
        style={styles.label}
      >
        {label}
      </Text>
      {right ??
        (onPress && !destructive ? (
          <ChevronRight
            size={20}
            color={theme.colors.onSurfaceVariant}
            opacity={0.5}
          />
        ) : null)}
    </>
  );

  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackMd,
    padding: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.glassTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  pressed: {
    backgroundColor: theme.colors.glassTintStrong,
  },

  label: {
    flex: 1,
  },
}));
