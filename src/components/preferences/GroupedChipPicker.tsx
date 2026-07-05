import { Chip } from "@/src/components/preferences/Chip";
import { Text } from "@/src/components/Text";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Group = {
  label: string;
  items: readonly string[];
};

type Props = {
  groups: readonly Group[];
  selected: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
};

export function GroupedChipPicker({
  groups,
  selected,
  onToggle,
  disabled = false,
}: Props) {
  return (
    <View style={styles.root}>
      {groups.map((group) => (
        <CollapsibleGroup
          key={group.label}
          group={group}
          selected={selected}
          onToggle={onToggle}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

function CollapsibleGroup({
  group,
  selected,
  onToggle,
  disabled,
}: {
  group: Group;
  selected: string[];
  onToggle: (value: string) => void;
  disabled: boolean;
}) {
  const { theme } = useUnistyles();
  const count = group.items.filter((i) => selected.includes(i)).length;
  const [open, setOpen] = useState(count > 0);

  return (
    <Animated.View layout={LinearTransition.duration(180)} style={styles.group}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={group.label}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Text
          variant="labelCaps"
          color="onSurfaceVariant"
          opacity={open ? 0.9 : 0.6}
          style={styles.label}
        >
          {group.label.toUpperCase()}
        </Text>
        <View style={styles.headerRight}>
          {count > 0 && (
            <Text variant="labelCaps" color="primary">
              {count}
            </Text>
          )}
          <ChevronDown
            size={16}
            color={theme.colors.onSurfaceVariant}
            style={open ? styles.chevronOpen : undefined}
          />
        </View>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.chipWrap}>
          {group.items.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={selected.includes(item)}
              onPress={() => onToggle(item)}
              disabled={disabled}
            />
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.stackSm,
  },
  group: {
    gap: theme.spacing.stackSm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.stackXs,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  label: {
    letterSpacing: 2,
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.stackSm,
    paddingBottom: theme.spacing.stackSm,
  },
  pressed: {
    opacity: 0.6,
  },
}));
