import { layoutBreakpoints } from "@/src/theme/breakpoints";

/** Canonical geometry shared by loaded and loading Home shelves. */
export const shelfLayout = {
  compact: {
    scrollMargin: "edge",
    horizontalInset: "page",
    flexWrap: "nowrap",
    contentWidth: undefined,
    tileWidth: 140,
    tileBasis: 140,
    tileGrow: 0,
    tileMinWidth: undefined,
    tileMaxWidth: undefined,
    artworkHeight: 140,
    extraSkeletonDisplay: "none",
  },
  desktop: {
    scrollMargin: 0,
    horizontalInset: 0,
    flexWrap: "wrap",
    contentWidth: "100%",
    tileWidth: undefined,
    tileBasis: 180,
    tileGrow: 1,
    tileMinWidth: 180,
    tileMaxWidth: 240,
    artworkHeight: 180,
    extraSkeletonDisplay: "flex",
  },
} as const;

export const shelfLayoutBreakpoints = {
  flexWrap: {
    xs: shelfLayout.compact.flexWrap,
    xl: shelfLayout.desktop.flexWrap,
  },
  contentWidth: {
    xs: shelfLayout.compact.contentWidth,
    xl: shelfLayout.desktop.contentWidth,
  },
  tileWidth: {
    xs: shelfLayout.compact.tileWidth,
    xl: shelfLayout.desktop.tileWidth,
  },
  tileBasis: {
    xs: shelfLayout.compact.tileBasis,
    xl: shelfLayout.desktop.tileBasis,
  },
  tileGrow: {
    xs: shelfLayout.compact.tileGrow,
    xl: shelfLayout.desktop.tileGrow,
  },
  tileMinWidth: {
    xs: shelfLayout.compact.tileMinWidth,
    xl: shelfLayout.desktop.tileMinWidth,
  },
  tileMaxWidth: {
    xs: shelfLayout.compact.tileMaxWidth,
    xl: shelfLayout.desktop.tileMaxWidth,
  },
  artworkHeight: {
    xs: shelfLayout.compact.artworkHeight,
    xl: shelfLayout.desktop.artworkHeight,
  },
  extraSkeletonDisplay: {
    xs: shelfLayout.compact.extraSkeletonDisplay,
    xl: shelfLayout.desktop.extraSkeletonDisplay,
  },
} as const;

export function resolveShelfLayout(width: number) {
  return width >= layoutBreakpoints.desktop
    ? shelfLayout.desktop
    : shelfLayout.compact;
}
