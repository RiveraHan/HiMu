import { resolveLayoutMode, type LayoutMode } from "@/src/theme/layout";

const compactFormLayout = {
  contentDirection: "column",
  railDisplay: "none",
  reviewPosition: "relative",
  footerPosition: "relative",
} as const;

const desktopFormLayout = {
  contentDirection: "row",
  railDisplay: "flex",
  reviewPosition: "sticky",
  footerPosition: "relative",
} as const;

export type ResponsiveFormLayout = typeof compactFormLayout | typeof desktopFormLayout;

/**
 * Resolves the same compact/desktop presentation contract consumed by the
 * Unistyles maps below. Medium intentionally retains compact form flow.
 */
export function resolveResponsiveFormLayout(width: number): ResponsiveFormLayout {
  const mode: LayoutMode = resolveLayoutMode(width);
  return mode === "desktop" ? desktopFormLayout : compactFormLayout;
}

/** Creates a mobile-first Unistyles map from the canonical form layout values. */
export function responsiveFormStyle<const Compact, const Desktop>(
  compact: Compact,
  desktop: Desktop,
) {
  return { xs: compact, xl: desktop };
}

export const formLayout = {
  compact: compactFormLayout,
  desktop: desktopFormLayout,
} as const;
