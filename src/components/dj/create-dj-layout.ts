export type CreateDjLayoutMode = "compact" | "medium" | "wide";

export type CreateDjLayoutInput = Readonly<{
  width: number;
  height: number;
  fontScale: number;
}>;

export type CreateDjLayout = Readonly<{
  mode: CreateDjLayoutMode;
  lowHeight: boolean;
}>;

const MEDIUM_MIN_WIDTH = 768;
const WIDE_MIN_WIDTH = 1024;
const LOW_HEIGHT_MAX = 599;

/**
 * Resolves presentation from the effective measured width. Enlarged text
 * raises the space required by the rail/editor/summary composition, so a wide
 * viewport reflows instead of squeezing its regions.
 */
export function resolveCreateDjLayout({
  width,
  height,
  fontScale,
}: CreateDjLayoutInput): CreateDjLayout {
  const safeFontScale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const wideMinimum = WIDE_MIN_WIDTH * Math.max(1, safeFontScale);
  const mode: CreateDjLayoutMode = width >= wideMinimum
    ? "wide"
    : width >= MEDIUM_MIN_WIDTH
      ? "medium"
      : "compact";

  return { mode, lowHeight: height <= LOW_HEIGHT_MAX };
}
