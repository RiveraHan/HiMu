import { GlassCard, Text } from "@/src/components";
import { ReactNode } from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type Variant = "primary" | "glass" | "ghost";

interface Props {
  variant?: Variant;
  onPress?: () => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  variant = "primary",
  onPress,
  label,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  loadingLabel = "Loading...",
  style,
  testID,
}: Props) {
  const isDisabled = disabled || loading;
  const text = loading ? loadingLabel : label;

  const content = (
    <>
      {leftIcon}
      <Text
        variant="labelCaps"
        color={variant === "primary" ? "onPrimaryContainer" : "onSurface"}
        numberOfLines={1}
        style={styles.label}
      >
        {text}
      </Text>
      {rightIcon}
    </>
  );

  if (variant === "glass") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        style={({ pressed }) => [
          isDisabled && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        <GlassCard level={1} style={styles.glassCard}>
          {content}
        </GlassCard>
      </Pressable>
    );
  }

  if (variant === "ghost") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        style={({ pressed }) => [
          isDisabled && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [
        styles.primary,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  primary: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    backgroundColor: theme.colors.primaryContainer,
    boxShadow: theme.shadows.primaryButton,
    paddingHorizontal: theme.spacing.gutter,
  },
  glassCard: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.md,
    padding: 0,
  },
  label: {
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
}));
