import type { ReactNode } from "react";
import { View } from "react-native";

import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { useWebCorePresentation } from "@/src/components/web-core-presentation";

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
  useWebCorePresentation("himu-web-core-presentation/player-stage");
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
    gap: { xs: theme.spacing.stackLg, xl: theme.spacing.stackLg * 2 },
    minWidth: 0,
  },
  artwork: {
    flexBasis: { xs: "auto", xl: 0 },
    flexGrow: { xs: 0, xl: 1 },
    flexShrink: { xs: 0, xl: 1 },
    minWidth: 0,
  },
  playback: {
    flexBasis: { xs: "auto", xl: 0 },
    flexGrow: { xs: 0, xl: 1 },
    flexShrink: { xs: 0, xl: 1 },
    minWidth: 0,
  },
}));
