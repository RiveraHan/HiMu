import type { ReactNode } from "react";
import { View } from "react-native";

import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  children: ReactNode;
};

type Slot = "artwork" | "playback";

type SlotProps = {
  slot: Slot;
  children: ReactNode;
};

/**
 * Presentation-only stage. Breakpoint styles retain the compact reading order
 * while giving artwork and playback equal space on a desktop canvas.
 */
export function PlayerDesktopLayout({ children }: Props) {
  return (
    <View testID="player-desktop-stage" style={styles.root}>
      {children}
    </View>
  );
}

export function PlayerDesktopLayoutSlot({ slot, children }: SlotProps) {
  return (
    <View testID={`player-desktop-${slot}`} style={styles[slot]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    flexDirection: { xs: "column", xl: "row" },
    alignItems: "stretch",
    gap: { xs: 0, xl: theme.spacing.stackLg * 2 },
    minWidth: 0,
  },
  artwork: {
    flex: { xs: 1, xl: 1 },
    minWidth: 0,
  },
  playback: {
    flex: { xs: 0, xl: 1 },
    minWidth: 0,
  },
}));
