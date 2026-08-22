import * as layout from "@/src/theme/layout";

describe("resolveLayoutMode", () => {
  it.each([
    [767, "compact"],
    [768, "medium"],
    [1023, "medium"],
    [1024, "desktop"],
  ] as const)("classifies %i pixels as %s", (width, expected) => {
    expect(layout.resolveLayoutMode(width)).toBe(expected);
  });
});
