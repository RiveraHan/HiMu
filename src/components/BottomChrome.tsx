import { useSegments } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

import { useActivity } from "@/src/activity";
import { useAppTour } from "@/src/onboarding";
import { usePlayerStore } from "@/src/stores/player-store";
import { ActivityPill } from "./activity/ActivityPill";
import {
  bottomChromeCanvasGeometry,
  isApplicationChromeHidden,
  TAB_BAR_BOTTOM,
  TAB_BAR_HEIGHT,
} from "./bottom-chrome-metrics";
import { MiniPlayer } from "./MiniPlayer";
import { canvasMaxWidth, resolveLayoutMode } from "@/src/theme/layout";

export function BottomChrome() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useUnistyles();
  const { phase } = useAppTour();
  const track = usePlayerStore((state) => state.currentTrack);
  const {
    primary,
    activeCount,
    isInitialLoading,
    isOffline,
    queryError,
  } = useActivity();

  const hiddenRoute = isApplicationChromeHidden(segments);
  if (hiddenRoute || phase !== "idle") return null;

  const fallbackStatus = isOffline
    ? "offline"
    : queryError
      ? "error"
      : isInitialLoading
        ? "loading"
        : undefined;
  const hasActivityTrigger = primary !== null || fallbackStatus !== undefined;
  if (!track && !hasActivityTrigger) return null;

  const isDesktop = resolveLayoutMode(width) === "desktop";
  const hasTabBar = segments[0] === "(app)" && !isDesktop;
  const bottom = hasTabBar
    ? insets.bottom + TAB_BAR_BOTTOM + TAB_BAR_HEIGHT + theme.spacing.stackSm
    : insets.bottom + theme.spacing.stackSm;
  const canvas = bottomChromeCanvasGeometry({
    windowWidth: width,
    safeStart: insets.left,
    safeEnd: insets.right,
    hasDesktopRail: isDesktop,
    horizontalMargin: theme.spacing.pageMargin,
    maxCanvasWidth: canvasMaxWidth.max,
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { bottom, left: canvas.left, width: canvas.width }]}
      testID="bottom-chrome"
    >
      <View style={styles.stack} testID="bottom-chrome-stack">
        {hasActivityTrigger ? (
          <ActivityPill
            activity={primary}
            activeCount={activeCount}
            fallbackStatus={fallbackStatus}
          />
        ) : null}
        {track ? <MiniPlayer /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    position: "absolute",
    left: 0,
    alignItems: "center",
    zIndex: 20,
  },
  stack: {
    width: "100%",
    alignSelf: "center",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
}));
