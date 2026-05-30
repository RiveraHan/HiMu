import { usePlayerStore } from "@/src/stores/player-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnistyles } from "react-native-unistyles";

const TAB_BAR_BOTTOM = 8; // space between the tab pill and the safe area
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 64;

/**
 * paddingBottom for scrollable content in screens with a tab bar.
 * Reserves the height of the tab pill and, when a track is active, also the
 * floating MiniPlayer height (which is mounted above). Returns a number ready
 * to use in `contentContainerStyle`.
 */
export function useTabBarPadding() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const hasTrack = usePlayerStore((state) => state.currentTrack != null);

  // top edge of the tab pill
  const base = insets.bottom + TAB_BAR_BOTTOM + TAB_BAR_HEIGHT;
  // the MiniPlayer adds its gap + its height when visible
  const miniPlayer = hasTrack ? theme.spacing.stackSm + MINI_PLAYER_HEIGHT : 0;

  return base + miniPlayer + theme.spacing.stackLg;
}
