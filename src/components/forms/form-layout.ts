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

/** Creates a mobile-first Unistyles map from the canonical form layout values. */
export function responsiveFormStyle<const Compact, const Desktop>(
  compact: Compact,
  desktop: Desktop,
) {
  return { xs: compact, xl: desktop };
}

type ResponsiveFormStyle<Compact, Desktop> = {
  xs: Compact;
  xl: Desktop;
};

/**
 * Resolves an exact responsive style map that a form component passed to
 * Unistyles. Medium intentionally retains the compact form presentation.
 */
export function resolveResponsiveFormStyle<Compact, Desktop>(
  style: ResponsiveFormStyle<Compact, Desktop>,
  width: number,
): Compact | Desktop {
  const mode: LayoutMode = resolveLayoutMode(width);
  return style[mode === "desktop" ? "xl" : "xs"];
}

/**
 * The single source of truth for responsive form presentation. Components use
 * these exact values in their Unistyles maps; tests resolve the rendered maps
 * through `resolveResponsiveFormStyle` at each viewport contract.
 */
export const formLayoutContract = {
  contentDirection: responsiveFormStyle(
    compactFormLayout.contentDirection,
    desktopFormLayout.contentDirection,
  ),
  railDisplay: responsiveFormStyle(
    compactFormLayout.railDisplay,
    desktopFormLayout.railDisplay,
  ),
  railFlex: responsiveFormStyle(0, 1),
  reviewPosition: responsiveFormStyle(
    compactFormLayout.reviewPosition,
    desktopFormLayout.reviewPosition,
  ),
  editorFlex: responsiveFormStyle(0, 1),
  scrollStyle: { flex: 1, overflow: "scroll" },
  scrollContentStyle: { flexGrow: 1 },
  footerStyle: {
    position: compactFormLayout.footerPosition,
    flexShrink: 0,
  },
} as const;

/** Exact ScrollView props used by the form shell and exercised in the web test. */
export const formScrollViewProps = {
  style: formLayoutContract.scrollStyle,
  contentContainerStyle: formLayoutContract.scrollContentStyle,
  keyboardShouldPersistTaps: "handled" as const,
};
