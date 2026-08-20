import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  children: ReactNode;
};

type Slot = "hero" | "djs" | "shelves" | "lower" | "library" | "supporting";

type SlotProps = {
  slot: Slot;
  children: ReactNode;
};

/**
 * Keeps Home's content in its reading order while CSS breakpoints compose the
 * wide canvas. Data, playback, tour targets, and failure states remain owned
 * by HomeScreen.
 */
export function HomeDesktopGrid({
  children,
}: Props) {
  return (
    <View
      testID="home-desktop-grid"
      style={styles.root}
    >
      {children}
    </View>
  );
}

export function HomeDesktopGridSlot({ slot, children }: SlotProps) {
  return (
    <View
      testID={slot === "hero" ? "home-daily-hero" : `home-desktop-${slot}`}
      style={styles[slot]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.stackLg,
  },
  hero: {
    minWidth: 0,
  },
  djs: {
    minWidth: 0,
  },
  shelves: {
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  lower: {
    flexDirection: { xs: "column", xl: "row" },
    alignItems: "stretch",
    gap: theme.spacing.stackLg,
  },
  library: {
    flex: { xs: 0, xl: 3 },
    gap: theme.spacing.stackMd,
    minWidth: 0,
  },
  supporting: {
    flex: { xs: 0, xl: 2 },
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
}));
