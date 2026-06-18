import { Text } from "@/src/components/Text";
import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type Option<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
  disabled?: boolean;
};

export function Segement<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: Props<T>) {
  return (
    <View style={[styles.track, disabled && styles.disabled]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
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
    backgroundColor: theme.colors.onSurfaceVariant,
    gap: theme.spacing.stackXs,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.full,
  },
  segmentActive: {
    backgroundColor: theme.colors.primaryContainer,
    boxShadow: theme.shadows.glow,
  },
  disabled: { opacity: 0.4 },
}));
