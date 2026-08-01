export const TAB_BAR_BOTTOM = 8;
export const TAB_BAR_HEIGHT = 64;
export const MINI_PLAYER_HEIGHT = 64;
export const ACTIVITY_PILL_HEIGHT = 48;

type BottomChromePaddingInput = {
  safeBottom: number;
  hasTabBar: boolean;
  hasPlayer: boolean;
  hasActivity: boolean;
  gap: number;
  tail: number;
  fontScale: number;
};

export function bottomChromePadding({
  safeBottom,
  hasTabBar,
  hasPlayer,
  hasActivity,
  gap,
  tail,
  fontScale,
}: BottomChromePaddingInput): number {
  const chromeScale = Math.max(1, fontScale);

  return (
    safeBottom +
    (hasTabBar ? TAB_BAR_BOTTOM + TAB_BAR_HEIGHT : 0) +
    (hasPlayer ? gap + MINI_PLAYER_HEIGHT * chromeScale : 0) +
    (hasActivity ? gap + ACTIVITY_PILL_HEIGHT * chromeScale : 0) +
    tail
  );
}
