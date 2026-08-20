import type { ReactNode } from "react";
import { Pressable, type AccessibilityState } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

const SIZES = { sm: 36, md: 44, lg: 52 } as const;

type Props = {
  icon: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  size?: keyof typeof SIZES;
  variant?: "plain" | "glass" | "glassStrong";
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  testID?: string;
};

export function IconButton({
  icon,
  onPress,
  disabled = false,
  size = "md",
  variant = "plain",
  accessibilityLabel,
  accessibilityState,
  testID,
}: Props) {
  const dimension = SIZES[size];
  const hitSlop = size === "sm" ? 4 : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === "glass" && styles.glass,
        variant === "glassStrong" && styles.glassStrong,
        { width: dimension, height: dimension },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.full,
    borderCurve: "continuous",
  },
  glass: {
    backgroundColor: theme.colors.glassTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  glassStrong: {
    backgroundColor: theme.colors.glassTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.4,
  },
}));
