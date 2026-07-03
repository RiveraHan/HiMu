import { forwardRef } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Text } from "./Text";

type Props = TextInputProps & {
  label?: string;
  hint?: string;
};

export const GlassInput = forwardRef<TextInput, Props>(function GlassInput(
  { label, hint, style, multiline, ...rest },
  ref,
) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.wrap}>
      {!!label && (
        <Text variant="labelCaps" color="onSurfaceVariant">
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, style]}
        {...rest}
      />
      {!!hint && (
        <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.6}>
          {hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.spacing.stackXs,
  },
  input: {
    ...theme.typography.bodyMd,
    color: theme.colors.onSurface,
    backgroundColor: theme.colors.glassTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    paddingHorizontal: theme.spacing.stackMd,
    paddingVertical: theme.spacing.stackMd - 4,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
}));
