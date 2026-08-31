import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";

import { resolveBetaVisualLayout } from "@/src/components/beta-visual-layout";
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
  const { width, height } = useWindowDimensions();
  const layout = resolveBetaVisualLayout({ width, height });

  return (
    <View
      testID="player-desktop-stage"
      style={[
        styles.root,
        layout.useDocumentFlowActions
          ? styles.documentFlow
          : styles.desktop,
      ]}
    >
      {children}
    </View>
  );
}

export function PlayerDesktopLayoutSlot({ slot, children }: SlotProps) {
  const { width, height } = useWindowDimensions();
  const layout = resolveBetaVisualLayout({ width, height });

  return (
    <View
      testID={`player-desktop-${slot}`}
      style={[
        styles[slot],
        layout.useDocumentFlowActions && styles.documentFlowSlot,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    alignItems: "stretch",
    gap: { xs: theme.spacing.stackLg, xl: theme.spacing.stackLg * 2 },
    minWidth: 0,
  },
  documentFlow: {
    flexDirection: "column",
  },
  desktop: {
    flexDirection: "row",
  },
  documentFlowSlot: {
    flexBasis: "auto",
    flexGrow: 0,
    flexShrink: 0,
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
