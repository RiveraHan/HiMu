import { ComponentProps, ReactNode } from "react";
import { Text } from "@/src/components/Text";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

type Props = {
  icon: ReactNode;
  label: string;
  value?: string;
  opacity?: number;
  valueColor?: ComponentProps<typeof Text>["color"];
  accessory?: ReactNode;
  onPress?: () => void;
};

export function SettingsInfoRow({
  icon,
  label,
  value,
  opacity,
  valueColor = "onSurfaceVariant",
  accessory,
  onPress,
}: Props) {
  const { theme } = useUnistyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        pressed && !!onPress && styles.pressed,
      ]}
    >
      <View style={styles.iconCircle}>{icon}</View>
      <View style={styles.text}>
        <Text variant="bodyLg" numberOfLines={1}>
          {label}
        </Text>
        {!!value && (
          <Text
            variant="bodyMd"
            color={valueColor}
            numberOfLines={1}
            opacity={opacity ?? 1}
          >
            {value}
          </Text>
        )}
      </View>
      {accessory ??
        (onPress ? (
          <ChevronRight size={20} color={theme.colors.outline} />
        ) : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  pressed: { opacity: 0.6 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
}));
