import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DESKTOP_RAIL_WIDTH } from "@/src/components/bottom-chrome-metrics";
import { DesktopRail } from "@/src/components/navigation/DesktopRail";
import { useWebCorePresentation } from "@/src/components/web-core-presentation";
import { resolveLayoutMode } from "@/src/theme/layout";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

export function resolveResponsiveAppContentInset(
  width: number,
  safeLeftInset: number,
  showRail = true,
) {
  return showRail && resolveLayoutMode(width) === "desktop"
    ? safeLeftInset + DESKTOP_RAIL_WIDTH
    : 0;
}

export function ResponsiveAppShell({
  children,
  showRail = true,
}: {
  children: React.ReactNode;
  showRail?: boolean;
}) {
  useWebCorePresentation("himu-web-core-presentation/app-shell");
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentInset = resolveResponsiveAppContentInset(width, insets.left, showRail);
  const hasDesktopRail = contentInset > 0;

  return (
    <View style={styles.root} testID="responsive-app-shell">
      {hasDesktopRail ? <DesktopRail /> : null}
      <View
        style={[
          styles.content,
          hasDesktopRail && { paddingLeft: contentInset },
        ]}
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
