import { Text } from "@/src/components/Text";
import { Check, Plus, X } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  add?: boolean;
  disabled?: boolean;
};

export function Chip({
  label,
  selected,
  onPress,
  onRemove,
  add,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  if (onRemove) {
    return (
      <View style={[styles.chip, styles.removable]}>
        <Text variant="labelCaps" color="onSurfaceVariant">
          {label}
        </Text>
        <Pressable
          onPress={onRemove}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.actions.removeLabel", { label })}
        >
          <X size={14} color={theme.colors.onSurfaceVariant} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        add ? styles.add : selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      {add && <Plus size={14} color={theme.colors.outline} />}
      {selected && !add && (
        <Check size={14} color={theme.colors.onPrimaryContainer} />
      )}
      <Text
        variant="labelCaps"
        color={
          add ? "outline" : selected ? "onPrimaryContainer" : "onSurfaceVariant"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackXs + 2,
    paddingHorizontal: theme.spacing.stackMd - 2,
    paddingVertical: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  selected: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.primaryContainer,
    boxShadow: theme.shadows.glow,
  },
  unselected: {
    backgroundColor: "transparent",
    borderColor: theme.colors.glassBorder,
  },
  add: {
    backgroundColor: "transparent",
    borderColor: theme.colors.outlineVariant,
    borderStyle: "dashed",
  },
  removable: {
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderColor: theme.colors.glassBorder,
  },
  pressed: {
    opacity: 0.6,
  },
}));
