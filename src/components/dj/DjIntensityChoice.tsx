import { Pressable, View } from "react-native";

import type { DjIntensityChoice as DjIntensityChoiceValue } from "./create-dj-wizard-state";
import { Text } from "@/src/components/Text";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

export type DjIntensityOption = Readonly<{
  value: DjIntensityChoiceValue;
  label: string;
  description: string;
}>;

export type DjIntensityChoiceProps = Readonly<{
  value: DjIntensityChoiceValue;
  options: readonly DjIntensityOption[];
  accessibilityLabel: string;
  disabled?: boolean;
  onChange(value: DjIntensityChoiceValue): void;
}>;

export function DjIntensityChoice({ value, options, accessibilityLabel, disabled = false, onChange }: DjIntensityChoiceProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.root}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled]}
          >
            <Text variant="labelCaps" color={selected ? "onPrimaryContainer" : "onSurface"}>
              {option.label}
            </Text>
            <Text variant="bodyMd" color="onSurfaceVariant">{option.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { gap: theme.spacing.stackSm },
  option: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.stackMd,
    paddingVertical: theme.spacing.stackSm,
    gap: theme.spacing.stackXs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    borderRadius: theme.borderRadius.md,
  },
  optionSelected: { backgroundColor: theme.colors.primaryContainer },
  disabled: { opacity: 0.4 },
}));
