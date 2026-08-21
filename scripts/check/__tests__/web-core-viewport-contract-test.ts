jest.mock("react-native-unistyles", () => {
  const ReactNative = require("react-native");
  const { darkTheme } = require("@/src/theme/theme");

  return {
    StyleSheet: {
      ...ReactNative.StyleSheet,
      configure: jest.fn(),
      create: (styles: unknown) =>
        typeof styles === "function" ? styles(darkTheme) : styles,
    },
    useUnistyles: () => ({ theme: darkTheme, rt: {} }),
  };
});

import {
  createTrackGridItemStyle,
  resolveTrackGridColumns,
} from "@/src/components/content/TrackGrid";
import { DESKTOP_RAIL_WIDTH } from "@/src/components/bottom-chrome-metrics";
import { DJ_TRACK_MIN_CARD_WIDTH } from "@/src/components/dj/DjDesktopLayout";
import { shelfLayoutBreakpoints } from "@/src/components/home/shelf-layout";
import { profileDjGridItemStyle } from "@/src/components/profile/ProfileDesktopLayout";
import { resolveResponsiveAppContentInset } from "@/src/components/ResponsiveAppShell";
import { breakpoints } from "@/src/theme/breakpoints";
import { canvasMaxWidth, resolveLayoutMode } from "@/src/theme/layout";
import { darkTheme } from "@/src/theme/theme";

function resolveBreakpointValue<T>(
  values: Partial<Record<keyof typeof breakpoints, T>>,
  width: number,
  fallback: T,
) {
  return (Object.entries(breakpoints) as [keyof typeof breakpoints, number][])
    .filter(([, breakpoint]) => breakpoint <= width)
    .reduce<T>((resolved, [name]) => values[name] ?? resolved, fallback);
}

describe("web core viewport contract", () => {
  it.each([
    [390, "compact", 1, "nowrap", "45%"],
    [768, "medium", 2, "nowrap", "45%"],
    [1024, "desktop", 4, "wrap", "31.5%"],
    [1440, "desktop", 6, "wrap", "23.5%"],
    [1920, "desktop", 6, "wrap", "23.5%"],
  ] as const)(
    "uses the actual responsive maps at %ipx",
    (width, layoutMode, columns, shelfWrap, profileCardBasis) => {
      expect(resolveLayoutMode(width)).toBe(layoutMode);
      expect(resolveTrackGridColumns(width)).toBe(columns);
      expect(resolveBreakpointValue(shelfLayoutBreakpoints.flexWrap, width, "nowrap")).toBe(shelfWrap);
      expect(resolveBreakpointValue(profileDjGridItemStyle.flexBasis, width, "45%")).toBe(profileCardBasis);

      const hasDesktopRail = resolveLayoutMode(width) === "desktop";
      expect(resolveResponsiveAppContentInset(width, 0)).toBe(
        hasDesktopRail ? DESKTOP_RAIL_WIDTH : 0,
      );

      for (const safeLeftInset of [0, 24]) {
        const contentInset = resolveResponsiveAppContentInset(width, safeLeftInset);
        expect(contentInset).toBe(
          hasDesktopRail ? safeLeftInset + DESKTOP_RAIL_WIDTH : 0,
        );

        const canvasWidth = Math.min(width - contentInset, canvasMaxWidth.max);
        const usableWidth = canvasWidth - 2 * darkTheme.spacing.pageMargin;
        const gridItemStyle = createTrackGridItemStyle(DJ_TRACK_MIN_CARD_WIDTH);
        const basis = resolveBreakpointValue(gridItemStyle.flexBasis, width, "100%");
        const cardWidth = Math.max(
          DJ_TRACK_MIN_CARD_WIDTH,
          usableWidth * Number.parseFloat(basis) / 100,
        );

        expect(columns * cardWidth + (columns - 1) * darkTheme.spacing.gutter).toBeLessThanOrEqual(
          usableWidth,
        );
        expect((columns + 1) * cardWidth + columns * darkTheme.spacing.gutter).toBeGreaterThan(
          usableWidth,
        );
      }
    },
  );
});
