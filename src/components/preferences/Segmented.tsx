import { Text } from "@/src/components/Text";
import { Pressable, View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { useRovingRadioGroup } from "./use-roving-radio-group";

type Option<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: Props<T>) {
  const radioProps = useRovingRadioGroup(
    options.map((option) => option.value),
    value,
    Boolean(disabled),
    onChange,
  );

  return (
    <View testID="segmented-radiogroup" accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.track, disabled && styles.disabled]}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <Pressable
            {...radioProps(index)}
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text
              variant="labelCaps"
              color={active ? "onPrimaryContainer" : "onSurfaceVariant"}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: "row",
    padding: theme.spacing.stackXs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceVariant,
    gap: theme.spacing.stackXs,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.full,
  },
  segmentActive: {
    backgroundColor: theme.colors.primaryContainer,
    boxShadow: theme.shadows.glow,
  },
  disabled: { opacity: 0.4 },
}));
