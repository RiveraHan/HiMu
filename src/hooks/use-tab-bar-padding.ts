import { useActivity } from "@/src/activity";
import { bottomChromePadding } from "@/src/components/bottom-chrome-metrics";
import { usePlayerStore } from "@/src/stores/player-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnistyles } from "react-native-unistyles";

function useChromePresence() {
  const hasPlayer = usePlayerStore((state) => state.currentTrack != null);
  const { primary, isInitialLoading, isOffline, queryError } = useActivity();
  return {
    hasPlayer,
    hasActivity:
      primary !== null || isInitialLoading || isOffline || queryError !== null,
  };
}

/**
 * paddingBottom for scrollable content in screens with a tab bar.
 * Reserves the height of the tab pill and, when a track is active, also the
 * floating MiniPlayer height (which is mounted above). Returns a number ready
 * to use in `contentContainerStyle`.
 */
export function useTabBarPadding() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { hasPlayer, hasActivity } = useChromePresence();

  return bottomChromePadding({
    safeBottom: insets.bottom,
    hasTabBar: true,
    hasPlayer,
    hasActivity,
    gap: theme.spacing.stackSm,
    tail: theme.spacing.stackLg,
  });
}

/**
 * paddingBottom for scrollable content in pushed screens (no tab bar), where
 * the floating MiniPlayer sits just above the safe area. Reserves its height
 * only while a track is active.
 */
export function useMiniPlayerPadding() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { hasPlayer, hasActivity } = useChromePresence();

  return bottomChromePadding({
    safeBottom: insets.bottom,
    hasTabBar: false,
    hasPlayer,
    hasActivity,
    gap: theme.spacing.stackSm,
    tail: theme.spacing.stackLg,
  });
}
