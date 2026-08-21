import { resolveTrackGridColumns } from "@/src/components/content/TrackGrid";
import { shelfLayoutBreakpoints } from "@/src/components/home/shelf-layout";
import { profileDjGridItemStyle } from "@/src/components/profile/ProfileDesktopLayout";
import { breakpoints } from "@/src/theme/breakpoints";
import { resolveLayoutMode } from "@/src/theme/layout";

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
    },
  );
});
