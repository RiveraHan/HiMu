import { ComponentProps, ReactNode } from "react";
import { Text } from "@/src/components/Text";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { Pressable, View, type AccessibilityRole } from "react-native";
import { ChevronRight } from "lucide-react-native";

type Props = {
  icon: ReactNode;
  label: string;
  value?: string;
  opacity?: number;
  valueColor?: ComponentProps<typeof Text>["color"];
  accessory?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
};

export function SettingsInfoRow({
  icon,
  label,
  value,
  opacity,
  valueColor = "onSurfaceVariant",
  accessory,
  onPress,
  disabled = false,
  accessibilityRole = "button",
}: Props) {
  const { theme } = useUnistyles();

  const content = (
    <>
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
    </>
  );

  return onPress ? (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityValue={value ? { text: value } : undefined}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
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
