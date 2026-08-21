import type { ReactNode } from "react";
import { View } from "react-native";

import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  children: ReactNode;
};

type Slot = "hero" | "actions" | "details" | "tracks";

type SlotProps = {
  slot: Slot;
  children: ReactNode;
};

/** The shared grid's wide-desktop six-card minimum on the 1280px DJ canvas. */
export const DJ_TRACK_MIN_CARD_WIDTH = 185;

/**
 * Responsive DJ presentation only. The slots retain their compact reading and
 * keyboard order while breakpoint styles create a wider hero and track canvas.
 */
export function DjDesktopLayout({ children }: Props) {
  return (
    <View testID="dj-desktop-layout" style={styles.root}>
      {children}
    </View>
  );
}

export function DjDesktopLayoutSlot({ slot, children }: SlotProps) {
  return (
    <View testID={`dj-desktop-${slot}`} style={styles[slot]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  hero: {
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  actions: {
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  details: {
    flexDirection: { xs: "column", xl: "row" },
    alignItems: "stretch",
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  tracks: {
    minWidth: 0,
  },
}));
