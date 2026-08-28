import { useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/preferences/Chip";
import { Text } from "@/src/components/Text";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { CatalogPickerSurface as NativeCatalogPickerSurface } from "./CatalogPickerSurface.native";
import { CatalogPickerSurface as WebCatalogPickerSurface } from "./CatalogPickerSurface.web";
import type { ProgressiveCatalogPickerProps } from "./progressive-catalog-types";

export type { CatalogPickerSurfaceProps, ProgressiveCatalogPickerProps } from "./progressive-catalog-types";

/** Explicit platform imports prevent Metro source-extension ordering from bypassing web. */
export function resolveCatalogPickerSurface(platform: string) {
  return platform === "web" ? WebCatalogPickerSurface : NativeCatalogPickerSurface;
}

const CatalogPickerSurface = resolveCatalogPickerSurface(Platform.OS);

export function nextCatalogSelection(
  selected: readonly string[],
  value: string,
  max: number,
): { next: string[]; rejected: boolean } {
  if (selected.includes(value)) {
    return { next: selected.filter((item) => item !== value), rejected: false };
  }
  if (selected.length >= max) return { next: [...selected], rejected: true };
  return { next: [...selected, value], rejected: false };
}

export function ProgressiveCatalogPicker({
  title,
  groups,
  selected,
  min,
  max,
  getGroupLabel,
  getItemLabel,
  onChange,
}: ProgressiveCatalogPickerProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [limitAnnouncement, setLimitAnnouncement] = useState("");

  const selectedLabels = useMemo(
    () => selected.map(getItemLabel),
    [getItemLabel, selected],
  );

  const open = () => {
    setQuery("");
    setExpandedGroup(groups[0]?.label ?? null);
    setLimitAnnouncement("");
    setVisible(true);
  };

  const close = () => setVisible(false);
  const toggle = (value: string) => {
    const result = nextCatalogSelection(selected, value, max);
    if (result.rejected) {
      setLimitAnnouncement(`Choose up to ${max}`);
      return;
    }
    setLimitAnnouncement("");
    onChange(result.next);
  };

  return (
    <View style={styles.root}>
      <Button label={`Edit ${title}`} variant="glass" onPress={open} />
      {selectedLabels.length > 0 ? (
        <Text accessibilityLabel={`Selected: ${selectedLabels.join(", ")}`} variant="bodyMd">
          Selected: {selectedLabels.join(", ")}
        </Text>
      ) : null}
      <CatalogPickerSurface
        visible={visible}
        title={title}
        groups={groups}
        selected={selected}
        min={min}
        max={max}
        query={query}
        expandedGroup={expandedGroup}
        getGroupLabel={getGroupLabel}
        getItemLabel={getItemLabel}
        onChange={onChange}
        onQueryChange={setQuery}
        onExpandedGroupChange={setExpandedGroup}
        onToggle={toggle}
        onDone={close}
        onRequestClose={close}
      >
        <CatalogPickerContents
          groups={groups}
          selected={selected}
          query={query}
          expandedGroup={expandedGroup}
          getGroupLabel={getGroupLabel}
          getItemLabel={getItemLabel}
          onExpandedGroupChange={setExpandedGroup}
          onToggle={toggle}
          limitAnnouncement={limitAnnouncement}
        />
      </CatalogPickerSurface>
    </View>
  );
}

type ContentsProps = Pick<ProgressiveCatalogPickerProps, "groups" | "selected" | "getGroupLabel" | "getItemLabel"> & {
  query: string;
  expandedGroup: string | null;
  onExpandedGroupChange(group: string | null): void;
  onToggle(value: string): void;
  limitAnnouncement: string;
};

function CatalogPickerContents({
  groups,
  selected,
  query,
  expandedGroup,
  getGroupLabel,
  getItemLabel,
  onExpandedGroupChange,
  onToggle,
  limitAnnouncement,
}: ContentsProps) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      getItemLabel(item).toLocaleLowerCase().includes(normalizedQuery),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <View style={styles.contents}>
      <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
        {limitAnnouncement}
      </Text>
      {selected.length > 0 ? (
        <View style={styles.tray}>
          <Text variant="labelCaps" color="onSurfaceVariant">Selected</Text>
          <View style={styles.trayChips}>
            {selected.map((value) => (
              <Chip key={value} label={getItemLabel(value)} onRemove={() => onToggle(value)} />
            ))}
          </View>
        </View>
      ) : null}
      {matchingGroups.map((group) => {
        const expanded = expandedGroup === group.label;
        const label = getGroupLabel(group.label);
        return (
          <View key={group.label} style={styles.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ expanded }}
              onPress={() => onExpandedGroupChange(expandedGroup === group.label ? null : group.label)}
              style={styles.groupButton}
            >
              <Text variant="labelCaps">{label}</Text>
            </Pressable>
            {expanded ? (
              <View style={styles.items}>
                {group.items.map((item) => {
                  const checked = selected.includes(item);
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="checkbox"
                      accessibilityLabel={getItemLabel(item)}
                      accessibilityState={{ checked }}
                      onPress={() => onToggle(item)}
                      style={[styles.item, checked && styles.itemChecked]}
                    >
                      <Text variant="bodyMd">{getItemLabel(item)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { gap: theme.spacing.stackSm },
  contents: { gap: theme.spacing.stackSm },
  tray: { gap: theme.spacing.stackXs },
  trayChips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.stackSm },
  group: { gap: theme.spacing.stackXs },
  groupButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.stackSm,
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderRadius: theme.borderRadius.md,
  },
  items: { gap: theme.spacing.stackXs },
  item: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.stackMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    borderRadius: theme.borderRadius.md,
  },
  itemChecked: { backgroundColor: theme.colors.primaryContainer },
  srOnly: { height: 1, width: 1, opacity: 0 },
}));
