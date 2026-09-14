import { Pressable, View } from "react-native";

import { Text } from "@/src/components/Text";
import { useRovingRadioGroup } from "@/src/components/preferences/use-roving-radio-group";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import type { Atmosphere } from "@/src/types/music-preferences";

export type AtmosphereOption = Readonly<{
  value: Atmosphere;
  label: string;
  description: string;
}>;

export type AtmosphereChoiceProps = Readonly<{
  value: Atmosphere;
  options: readonly AtmosphereOption[];
  accessibilityLabel: string;
  disabled?: boolean;
  onChange(value: Atmosphere): void;
}>;

export function AtmosphereChoice({
  value,
  options,
  accessibilityLabel,
  disabled = false,
  onChange,
}: AtmosphereChoiceProps) {
  const radioProps = useRovingRadioGroup(
    options.map((option) => option.value),
    value,
    disabled,
    onChange,
  );

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.root}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            {...radioProps(index)}
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.selected, disabled && styles.disabled]}
          >
            <Text variant="labelCaps" color={selected ? "onPrimaryContainer" : "onSurface"}>{option.label}</Text>
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
  selected: { backgroundColor: theme.colors.primaryContainer },
  disabled: { opacity: 0.4 },
}));
