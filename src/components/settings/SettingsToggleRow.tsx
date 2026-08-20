import { View } from "react-native";
import { Text } from "@/src/components/Text";
import { Toggle } from "./Toggle";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  label: string;
  value: boolean;
  description?: string;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};
export function SettingsToggleRow({
  icon,
  label,
  value,
  description,
  onValueChange,
  disabled,
}: Props) {
  return (
    <View style={styles.row}>
      {icon && <View style={styles.iconCircle}>{icon}</View>}
      <View style={styles.text}>
        <Text variant="bodyLg">{label}</Text>
        {!!description && (
          <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.7}>
            {description}
          </Text>
        )}
      </View>
      <Toggle
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.gutter,
  },
  text: {
    flex: 1,
    gap: theme.spacing.stackXs,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
}));
