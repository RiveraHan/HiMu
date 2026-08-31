import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  resolveBetaVisualLayout,
  type BetaVisualLayout,
} from "@/src/components/beta-visual-layout";
import { DESKTOP_RAIL_WIDTH } from "@/src/components/bottom-chrome-metrics";
import { ConnectedDesktopRail } from "@/src/components/navigation/ConnectedDesktopRail";
import { useWebCorePresentation } from "@/src/components/web-core-presentation";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

function resolveContentInsetForLayout(
  layout: BetaVisualLayout,
  safeLeftInset: number,
  showRail: boolean,
) {
  return showRail && layout.band === "wide"
    ? safeLeftInset + DESKTOP_RAIL_WIDTH
    : 0;
}

export function resolveResponsiveAppContentInset(
  width: number,
  safeLeftInset: number,
  showRail = true,
) {
  return resolveContentInsetForLayout(
    resolveBetaVisualLayout({ width, height: 600 }),
    safeLeftInset,
    showRail,
  );
}

export function ResponsiveAppShell({
  children,
  showRail = true,
}: {
  children: React.ReactNode;
  showRail?: boolean;
}) {
  useWebCorePresentation("himu-web-core-presentation/app-shell");
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = resolveBetaVisualLayout({ width, height });
  const contentInset = resolveContentInsetForLayout(layout, insets.left, showRail);
  const hasDesktopRail = contentInset > 0;

  return (
    <View style={styles.root} testID="responsive-app-shell">
      {hasDesktopRail ? <ConnectedDesktopRail /> : null}
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
