import { useWindowDimensions, View } from "react-native";

import { DESKTOP_RAIL_WIDTH } from "@/src/components/bottom-chrome-metrics";
import { DesktopRail } from "@/src/components/navigation/DesktopRail";
import { resolveLayoutMode } from "@/src/theme/layout";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

export function ResponsiveAppShell({
  children,
  showRail = true,
}: {
  children: React.ReactNode;
  showRail?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = resolveLayoutMode(width) === "desktop" && showRail;

  return (
    <View style={styles.root} testID="responsive-app-shell">
      {isDesktop ? <DesktopRail /> : null}
      <View
        style={[styles.content, isDesktop && { paddingLeft: DESKTOP_RAIL_WIDTH }]}
        testID="responsive-app-content"
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
}));
