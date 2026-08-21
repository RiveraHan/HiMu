import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { useWebCorePresentation } from "@/src/components/web-core-presentation";

type Props = {
  children: ReactNode;
};

type Slot = "header" | "dashboard" | "stats" | "identity" | "djs" | "settings";

type SlotProps = {
  slot: Slot;
  children: ReactNode;
};

/** CSS grid widths preserve a two-card compact view, then use three and four
 * cards on the desktop canvas without a render-tree swap. */
export const profileDjGridItemStyle = {
  flexGrow: 1,
  flexBasis: { xs: "45%", xl: "31.5%", xxl: "23.5%" },
} as const;

/**
 * Presentation-only responsive profile canvas. Its slots preserve a single
 * source and keyboard order while desktop CSS arranges the dashboard.
 */
export function ProfileDesktopLayout({ children }: Props) {
  useWebCorePresentation("himu-web-core-presentation/profile-layout");
  return (
    <View testID="profile-desktop-layout" style={styles.root}>
      {children}
    </View>
  );
}

export function ProfileDesktopLayoutSlot({ slot, children }: SlotProps) {
  return (
    <View testID={`profile-desktop-${slot}`} style={styles[slot]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.stackLg,
  },
  header: {
    minWidth: 0,
  },
  dashboard: {
    flexDirection: { xs: "column", xl: "row" },
    alignItems: "stretch",
    gap: theme.spacing.stackLg,
  },
  stats: {
    flex: { xs: 0, xl: 3 },
    gap: theme.spacing.stackSm,
    minWidth: 0,
  },
  identity: {
    flex: { xs: 0, xl: 2 },
    gap: theme.spacing.stackSm,
    minWidth: 0,
  },
  djs: {
    flexBasis: { xs: "100%", xl: "23.5%" },
    minWidth: 0,
  },
  settings: {
    minWidth: 0,
  },
}));
